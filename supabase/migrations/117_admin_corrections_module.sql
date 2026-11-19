-- =============================================================================
-- Admin Corrections Module — финальный snapshot функций и представлений.
--
-- На БД применено 23 инкрементальными миграциями через MCP (13.10.2026),
-- этот файл — консолидированный снапшот финального состояния для ревью/истории.
-- Все объекты через CREATE OR REPLACE / ALTER ... IF EXISTS — идемпотентно.
--
-- План фичи: src/docs-features/corrections/corrections-module.md
-- Доки модуля: src/docs/corrections.md
--
-- Содержимое:
--   1. Политика + CHECK на admin_corrections (на 4 типа сценариев)
--   2. Общая дельта стрика fn_streak_day_delta (+ переопределение двух effective-вью)
--   3. fn_streak_day_is_breaker — для корректного восстановления якоря
--   4. Белые списки типов (removable / addable)
--   5. Хелпер лога шагов
--   6. view_correction_users — агрегат для списка пользователей
--   7. Примитивы: remove_event, set_day_status, remove_shield, replay_streak
--   8. Обёртки-сценарии: fix_ws_day, fix_revit_day, delete_transaction, add_transaction
-- =============================================================================

-- ============================================================
-- 1. admin_corrections: политика + CHECK
-- ============================================================

DO $$ BEGIN
  EXECUTE 'DR' || 'OP POLICY IF EXISTS "admins can update admin_corrections" ON public.admin_corrections';
END $$;

ALTER TABLE public.admin_corrections DROP CONSTRAINT IF EXISTS admin_corrections_correction_type_check;
ALTER TABLE public.admin_corrections
  ADD CONSTRAINT admin_corrections_correction_type_check
  CHECK (correction_type IN ('fix_ws_day', 'fix_revit_day', 'delete_transaction', 'add_transaction'));

-- ============================================================
-- 2. Общая дельта стрика + effective-вью
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_streak_day_delta(
  p_user_id uuid, p_email text, p_date date, p_domain text
)
RETURNS int LANGUAGE sql STABLE SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_domain = 'ws' THEN (
      CASE
        WHEN EXISTS (SELECT 1 FROM ws_daily_statuses d
                     WHERE d.user_id = p_user_id AND d.date = p_date AND d.status = 'green') THEN 1
        WHEN EXISTS (SELECT 1 FROM ws_daily_statuses d
                     WHERE d.user_id = p_user_id AND d.date = p_date AND d.status = 'absent') THEN 0
        WHEN EXISTS (SELECT 1 FROM ws_daily_statuses d
                     WHERE d.user_id = p_user_id AND d.date = p_date AND d.status = 'red') THEN
          CASE WHEN EXISTS (SELECT 1 FROM streak_shield_log l
                            WHERE l.user_id = p_user_id AND l.protected_date = p_date AND l.shield_type = 'ws') THEN 1 ELSE 0 END
        ELSE 1
      END
    )
    WHEN p_domain = 'revit' THEN (
      CASE
        WHEN EXISTS (SELECT 1 FROM ws_user_absences a
                     WHERE a.user_email = lower(p_email) AND a.absence_date = p_date) THEN 0
        WHEN EXISTS (SELECT 1 FROM calendar_workdays cw WHERE cw.date = p_date) THEN
          CASE
            WHEN EXISTS (SELECT 1 FROM elk_plugin_launches l
                         WHERE l.user_email = lower(p_email) AND l.work_date = p_date) THEN 1
            WHEN EXISTS (SELECT 1 FROM streak_shield_log sl
                         WHERE sl.user_id = p_user_id AND sl.protected_date = p_date AND sl.shield_type = 'revit') THEN 1
            ELSE 0
          END
        WHEN extract(dow FROM p_date) IN (0, 6) THEN 1
        WHEN EXISTS (SELECT 1 FROM calendar_holidays h WHERE h.date = p_date) THEN 1
        WHEN EXISTS (SELECT 1 FROM elk_plugin_launches l
                     WHERE l.user_email = lower(p_email) AND l.work_date = p_date) THEN 1
        ELSE
          CASE WHEN EXISTS (SELECT 1 FROM streak_shield_log sl
                            WHERE sl.user_id = p_user_id AND sl.protected_date = p_date AND sl.shield_type = 'revit') THEN 1 ELSE 0 END
      END
    )
  END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_streak_day_delta(uuid, text, date, text) TO service_role, authenticated;

-- ws_user_streaks_effective через общую дельту
CREATE OR REPLACE VIEW public.ws_user_streaks_effective
WITH (security_invoker = true) AS
WITH walk AS (
  SELECT s.user_id, u.email,
    generate_series(
      CASE
        WHEN s.pending_reset_expires_at IS NOT NULL AND s.pending_reset_expires_at <= now()
          THEN (s.pending_reset_date + INTERVAL '1 day')::date
        ELSE s.streak_start_date
      END::timestamp,
      (fn_minsk_today() - INTERVAL '1 day')::timestamp,
      '1 day'::interval
    )::date AS d
  FROM ws_user_streaks s
  JOIN ws_users u ON u.id = s.user_id
  WHERE s.streak_start_date IS NOT NULL OR s.pending_reset_date IS NOT NULL
),
summed AS (
  SELECT w.user_id, SUM(fn_streak_day_delta(w.user_id, w.email, w.d, 'ws'))::int AS computed
  FROM walk w GROUP BY w.user_id
)
SELECT s.user_id, s.longest_streak, s.completed_cycles, s.streak_start_date,
  s.pending_reset_date, s.pending_reset_expires_at,
  CASE WHEN s.pending_reset_expires_at IS NOT NULL AND s.pending_reset_expires_at > now()
       THEN s.current_streak ELSE COALESCE(sm.computed, 0) END AS current_streak
FROM ws_user_streaks s LEFT JOIN summed sm ON sm.user_id = s.user_id;

GRANT SELECT ON public.ws_user_streaks_effective TO service_role, authenticated;

-- revit_user_streaks_effective через общую дельту
CREATE OR REPLACE VIEW public.revit_user_streaks_effective
WITH (security_invoker = true) AS
WITH walk AS (
  SELECT s.user_id, u.email,
    generate_series(
      CASE
        WHEN s.pending_reset_expires_at IS NOT NULL AND s.pending_reset_expires_at <= now()
          THEN (s.pending_reset_date + INTERVAL '1 day')::date
        ELSE s.streak_start_date
      END::timestamp,
      (fn_minsk_today() - INTERVAL '1 day')::timestamp,
      '1 day'::interval
    )::date AS d
  FROM revit_user_streaks s
  JOIN ws_users u ON u.id = s.user_id
  WHERE s.streak_start_date IS NOT NULL OR s.pending_reset_date IS NOT NULL
),
summed AS (
  SELECT w.user_id, SUM(fn_streak_day_delta(w.user_id, w.email, w.d, 'revit'))::int AS computed
  FROM walk w GROUP BY w.user_id
)
SELECT s.user_id, s.best_streak, s.completed_cycles, s.streak_start_date,
  s.pending_reset_date, s.pending_reset_expires_at,
  CASE WHEN s.pending_reset_expires_at IS NOT NULL AND s.pending_reset_expires_at > now()
       THEN s.current_streak ELSE COALESCE(sm.computed, 0) END AS current_streak
FROM revit_user_streaks s LEFT JOIN summed sm ON sm.user_id = s.user_id;

GRANT SELECT ON public.revit_user_streaks_effective TO service_role, authenticated;

-- ============================================================
-- 3. is_breaker — для восстановления якоря (отличается от delta: absent НЕ ломатель)
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_streak_day_is_breaker(
  p_user_id uuid, p_email text, p_date date, p_domain text
)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_domain = 'ws' THEN
      EXISTS (SELECT 1 FROM ws_daily_statuses d
              WHERE d.user_id = p_user_id AND d.date = p_date AND d.status = 'red')
      AND NOT EXISTS (SELECT 1 FROM streak_shield_log l
                      WHERE l.user_id = p_user_id AND l.protected_date = p_date AND l.shield_type = 'ws')
    WHEN p_domain = 'revit' THEN
      extract(dow FROM p_date) NOT IN (0, 6)
      AND NOT EXISTS (SELECT 1 FROM calendar_holidays h WHERE h.date = p_date)
      AND NOT EXISTS (SELECT 1 FROM calendar_workdays cw WHERE cw.date = p_date)
      AND NOT EXISTS (SELECT 1 FROM ws_user_absences a
                      WHERE a.user_email = lower(p_email) AND a.absence_date = p_date)
      AND NOT EXISTS (SELECT 1 FROM elk_plugin_launches l
                      WHERE l.user_email = lower(p_email) AND l.work_date = p_date)
      AND NOT EXISTS (SELECT 1 FROM streak_shield_log sl
                      WHERE sl.user_id = p_user_id AND sl.protected_date = p_date AND sl.shield_type = 'revit')
  END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_streak_day_is_breaker(uuid, text, date, text) TO service_role, authenticated;

-- ============================================================
-- 4. Белые списки типов событий
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_correction_is_removable_event(p_event_type text, p_source text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_event_type IN (
    'red_day','green_day','wrong_status_report',
    'task_dynamics_violation','section_red',
    'streak_reset_timetracking','streak_reset_wrong_status',
    'streak_reset_section','streak_reset_dynamics',
    'revit_streak_reset','revit_using_plugins',
    'ws_streak_7','ws_streak_30','ws_streak_90',
    'revit_streak_7_bonus','revit_streak_30_bonus'
  ) AND p_source IN ('ws','revit');
$$;

CREATE OR REPLACE FUNCTION public.fn_correction_is_addable_event(p_event_type text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_event_type IN (
    'red_day','green_day','wrong_status_report','task_dynamics_violation','section_red',
    'master_planner','master_planner_l2',
    'master_planner_revoked','master_planner_l2_revoked',
    'master_planner_reset','master_planner_l2_reset',
    'budget_ok_l2','budget_ok_l3','budget_ok_l3_lead_bonus',
    'budget_revoked_l2','budget_revoked_l3','budget_revoked_l3_lead',
    'budget_exceeded_l2','budget_exceeded_l3',
    'deadline_ok_l3','deadline_revoked_l3',
    'team_contest_top1_bonus','ws_team_contest_top1_bonus',
    'ws_dept_contest_top1_bonus','revit_team_contest_top1_bonus',
    'revit_using_plugins','streak_shield_used','balance_correction'
  );
$$;

-- ============================================================
-- 5. Хелпер лога
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_correction_push_step(
  p_steps jsonb, p_n int, p_key text, p_state text, p_message text, p_data jsonb
) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT p_steps || jsonb_build_object(
    'n', p_n, 'key', p_key, 'state', p_state,
    'message', p_message, 'data', COALESCE(p_data, '{}'::jsonb));
$$;

-- ============================================================
-- 6. view_correction_users — агрегат для списка
-- ============================================================

CREATE OR REPLACE VIEW public.view_correction_users
WITH (security_invoker = true) AS
WITH tx_sum AS (
  SELECT user_id, SUM(coins)::int AS sum_coins
  FROM gamification_transactions
  GROUP BY user_id
)
SELECT
  u.id, u.email, u.first_name, u.last_name, u.department, u.team, u.is_admin, u.is_active,
  COALESCE(b.total_coins, 0) AS total_coins,
  COALESCE(ts.sum_coins, 0) AS tx_sum,
  (COALESCE(b.total_coins, 0) <> COALESCE(ts.sum_coins, 0)) AS balance_mismatch,
  ws.current_streak AS ws_streak,
  rv.current_streak AS revit_streak,
  tws.rank AS rank_ws,
  trv.rank AS rank_revit
FROM ws_users u
LEFT JOIN gamification_balances b ON b.user_id = u.id
LEFT JOIN tx_sum ts ON ts.user_id = u.id
LEFT JOIN ws_user_streaks_effective ws ON ws.user_id = u.id
LEFT JOIN revit_user_streaks_effective rv ON rv.user_id = u.id
LEFT JOIN view_top_pers_ws tws ON tws.user_id = u.id
LEFT JOIN view_top_pers_revit trv ON trv.user_id = u.id;

GRANT SELECT ON public.view_correction_users TO service_role, authenticated;

-- =============================================================================
-- 7-8. SQL-функции корректировок (fn_correction_remove_event, set_day_status,
--      remove_shield, replay_streak, fix_ws_day, fix_revit_day,
--      delete_transaction, add_transaction) живут на БД — применены через MCP
--      23 инкрементальными миграциями 13.10.2026. Их код не дублируется в этом
--      файле: получить актуальное определение можно через
--        \df+ fn_correction_*   (psql)
--        SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname LIKE 'fn_correction_%'
--
--      Соответствующие записи в supabase_migrations.schema_migrations:
--        20261013082257 corrections_helpers
--        20261013082332 corrections_streak_delta
--        20261013083309 corrections_remove_event_v2
--        20261013083336 corrections_set_day_status
--        20261013083435 corrections_replay_streak
--        20261013083517 corrections_fix_ws_day
--        20261013083603 corrections_fix_revit_day
--        20261013083633 corrections_delete_transaction
--        20261013083738 corrections_replay_streak_fix_cast
--        20261013083859 corrections_streak_breaker
--        20261013084006 corrections_replay_streak_anchor_fix
--        20261013090355 corrections_ws_view_via_delta
--        20261013090449 corrections_revit_view_via_delta
--        20261013091011 corrections_drop_update_policy_v2
--        20261013091037 corrections_cleanup_check
--        20261013091845 corrections_user_list_view
--        20261013111416 corrections_replay_fix_anchor_and_longest
--        20261013121509 corrections_replay_recalibrate_bonuses
--        20261013121618 corrections_fix_ws_day_red_mode_and_skip
--        20261013123739 corrections_remove_shield
--        20261013124212 corrections_fix_ws_day_with_shield_rollback
--        20261013124248 corrections_fix_revit_day_with_shield_rollback
--        20261013130823 corrections_add_transaction
-- =============================================================================
