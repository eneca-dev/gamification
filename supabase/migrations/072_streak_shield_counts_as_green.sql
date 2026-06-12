-- Фикс 1: день с использованным щитом даёт +1 к стрику.
--
-- Проблема: оба вью считали статус 'red' как delta=0 даже если щит был куплен.
-- streak_shield_log хранит факт использования щита, но deltas-CTE его не смотрела.
-- Пользователь покупал щит → стрик не сбрасывался, но спасённый день не входил в сумму.
--
-- Решение: в deltas-CTE обоих вью для любого дня, который иначе был бы 0 (кроме absent),
-- проверяем streak_shield_log. Если запись есть → delta=1.
-- Absent остаётся 0 даже при наличии щита — это «заморозка», не красный день.

-- ============================================================
-- WS: обновить ws_user_streaks_effective
-- ============================================================

CREATE OR REPLACE VIEW ws_user_streaks_effective
WITH (security_invoker = true)
AS
WITH walk AS (
  SELECT
    s.user_id,
    generate_series(
      CASE
        WHEN s.pending_reset_expires_at IS NOT NULL
             AND s.pending_reset_expires_at <= now()
        THEN (s.pending_reset_date + INTERVAL '1 day')::date
        ELSE s.streak_start_date
      END,
      fn_minsk_today() - INTERVAL '1 day',
      '1 day'
    )::date AS d
  FROM ws_user_streaks s
  WHERE s.streak_start_date IS NOT NULL
     OR s.pending_reset_date IS NOT NULL
),
deltas AS (
  SELECT
    w.user_id,
    CASE
      WHEN ds.status = 'green'  THEN 1
      WHEN ds.status = 'absent' THEN 0
      WHEN ds.status = 'red' THEN
        CASE WHEN EXISTS (
          SELECT 1 FROM streak_shield_log ssl
          WHERE ssl.user_id = w.user_id
            AND ssl.protected_date = w.d
            AND ssl.shield_type = 'ws'
        ) THEN 1 ELSE 0 END
      ELSE 1
    END AS delta
  FROM walk w
  LEFT JOIN ws_daily_statuses ds
    ON ds.user_id = w.user_id AND ds.date = w.d
),
summed AS (
  SELECT user_id, SUM(delta)::int AS computed
  FROM deltas
  GROUP BY user_id
)
SELECT
  s.user_id,
  s.longest_streak,
  s.completed_cycles,
  s.streak_start_date,
  s.pending_reset_date,
  s.pending_reset_expires_at,
  CASE
    WHEN s.pending_reset_expires_at IS NOT NULL
     AND s.pending_reset_expires_at > now()
    THEN s.current_streak
    ELSE COALESCE(sm.computed, 0)
  END AS current_streak
FROM ws_user_streaks s
LEFT JOIN summed sm ON sm.user_id = s.user_id;

GRANT SELECT ON ws_user_streaks_effective TO service_role;

-- ============================================================
-- Revit: обновить revit_user_streaks_effective
-- ============================================================

CREATE OR REPLACE VIEW revit_user_streaks_effective
WITH (security_invoker = true)
AS
WITH walk AS (
  SELECT
    s.user_id,
    u.email,
    generate_series(
      CASE
        WHEN s.pending_reset_expires_at IS NOT NULL
             AND s.pending_reset_expires_at <= now()
        THEN (s.pending_reset_date + INTERVAL '1 day')::date
        ELSE s.streak_start_date
      END,
      fn_minsk_today() - INTERVAL '1 day',
      '1 day'
    )::date AS d
  FROM revit_user_streaks s
  JOIN ws_users u ON u.id = s.user_id
  WHERE s.streak_start_date IS NOT NULL
     OR s.pending_reset_date IS NOT NULL
),
deltas AS (
  SELECT
    w.user_id,
    CASE
      -- absent → 0 (заморозка), щит не влияет
      WHEN EXISTS (
        SELECT 1 FROM ws_user_absences a
        WHERE a.user_email = lower(w.email)
          AND a.absence_date = w.d
      ) THEN 0
      -- рабочая суббота / перенос: запуски → 1, иначе проверяем щит
      WHEN EXISTS (
        SELECT 1 FROM calendar_workdays cw WHERE cw.date = w.d
      ) THEN
        CASE
          WHEN EXISTS (
            SELECT 1 FROM elk_plugin_launches l
            WHERE l.user_email = lower(w.email)
              AND l.work_date = w.d
          ) THEN 1
          WHEN EXISTS (
            SELECT 1 FROM streak_shield_log ssl
            WHERE ssl.user_id = w.user_id
              AND ssl.protected_date = w.d
              AND ssl.shield_type = 'revit'
          ) THEN 1
          ELSE 0
        END
      -- weekend (Сб/Вс) → +1
      WHEN extract(dow FROM w.d) IN (0, 6) THEN 1
      -- holiday → +1
      WHEN EXISTS (
        SELECT 1 FROM calendar_holidays h WHERE h.date = w.d
      ) THEN 1
      -- будний рабочий день: запуски → 1, иначе проверяем щит
      WHEN EXISTS (
        SELECT 1 FROM elk_plugin_launches l
        WHERE l.user_email = lower(w.email)
          AND l.work_date = w.d
      ) THEN 1
      ELSE
        CASE WHEN EXISTS (
          SELECT 1 FROM streak_shield_log ssl
          WHERE ssl.user_id = w.user_id
            AND ssl.protected_date = w.d
            AND ssl.shield_type = 'revit'
        ) THEN 1 ELSE 0 END
    END AS delta
  FROM walk w
),
summed AS (
  SELECT user_id, SUM(delta)::int AS computed
  FROM deltas
  GROUP BY user_id
)
SELECT
  s.user_id,
  s.best_streak,
  s.completed_cycles,
  s.streak_start_date,
  s.pending_reset_date,
  s.pending_reset_expires_at,
  CASE
    WHEN s.pending_reset_expires_at IS NOT NULL
     AND s.pending_reset_expires_at > now()
    THEN s.current_streak
    ELSE COALESCE(sm.computed, 0)
  END AS current_streak
FROM revit_user_streaks s
LEFT JOIN summed sm ON sm.user_id = s.user_id;

GRANT SELECT ON revit_user_streaks_effective TO service_role;
