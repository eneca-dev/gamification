-- Миграция Revit-стрика на view + перенос расчёта на VPS.
--
-- Зачем:
-- Сейчас Revit-стрик ведёт триггер fn_award_revit_points на INSERT в elk_plugin_launches,
-- а просроченные pending финализирует Edge Function через fn_finalize_expired_revit_pendings.
-- Стрик в revit_user_streaks.current_streak обновляется только в момент работы триггера
-- и «застывает» между запусками плагинов — UI показывает старое значение.
--
-- Решение (зеркало WS-стрика, см. 039_ws_user_streaks_effective_view.sql):
--   1. Добавить streak_start_date — якорь walk'а.
--   2. View revit_user_streaks_effective считает стрик на чтение по сырым launches.
--   3. Триггер упрощается до «лог + 5 💎 за первый плагин дня».
--   4. fn_finalize_expired_revit_pendings удаляется — phase 1 делает VPS-скрипт.
--
-- Семантика дельт view:
--   absent (vacation/sick) → 0 (заморозка)
--   рабочая суббота (calendar_workdays) → green if launches else red
--   weekend (Сб/Вс) → +1
--   holiday (calendar_holidays) → +1
--   будний рабочий день → green if launches else red
--   green → +1, red → 0
--
-- Pending grace: пока pending_reset_expires_at > now() view возвращает замороженное
-- current_streak из таблицы. После грейса — пересчитанное walk'ом.

-- ============================================================
-- 1a. ALTER TABLE: streak_start_date
-- ============================================================

ALTER TABLE revit_user_streaks
  ADD COLUMN IF NOT EXISTS streak_start_date date NULL;

-- ============================================================
-- 1b. CREATE VIEW revit_user_streaks_effective
-- ============================================================

CREATE OR REPLACE VIEW revit_user_streaks_effective
WITH (security_invoker = true)
AS
WITH walk AS (
  -- Точка старта walk:
  --   • если pending истёк (грейс прошёл) — стрик логически перезапускается со дня
  --     после red, даже если в таблице остался старый streak_start_date (vps ещё не
  --     финализировал)
  --   • иначе берём streak_start_date
  -- Во время активного грейса walk выполняется, но его результат не используется —
  -- финальный SELECT через CASE возвращает замороженное s.current_streak.
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
      -- absent → 0 (заморозка)
      WHEN EXISTS (
        SELECT 1 FROM ws_user_absences a
        WHERE a.user_email = lower(w.email)
          AND a.absence_date = w.d
      ) THEN 0
      -- рабочая суббота / перенос: green if launches, else red
      WHEN EXISTS (
        SELECT 1 FROM calendar_workdays cw WHERE cw.date = w.d
      ) THEN
        CASE WHEN EXISTS (
          SELECT 1 FROM elk_plugin_launches l
          WHERE l.user_email = lower(w.email)
            AND l.work_date = w.d
        ) THEN 1 ELSE 0 END
      -- weekend (Сб/Вс) → +1
      WHEN extract(dow FROM w.d) IN (0, 6) THEN 1
      -- holiday → +1
      WHEN EXISTS (
        SELECT 1 FROM calendar_holidays h WHERE h.date = w.d
      ) THEN 1
      -- будний рабочий день: green if launches, else red
      WHEN EXISTS (
        SELECT 1 FROM elk_plugin_launches l
        WHERE l.user_email = lower(w.email)
          AND l.work_date = w.d
      ) THEN 1
      ELSE 0
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

-- ============================================================
-- 1c. Упростить fn_award_revit_points
-- Оставляем только: идемпотентный лог + 5 💎 за первый плагин дня.
-- Убираем: всю логику стрика (current_streak, milestones, pending, gap_days,
-- last_green_date). Стрик теперь считается view'ом + VPS-скриптом.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_award_revit_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_employee_id  UUID;
  v_idem_key     TEXT;
  v_row_count    INTEGER;
  v_green_pts    INTEGER;
  v_event_id     UUID;
BEGIN
  SELECT coins INTO v_green_pts
  FROM gamification_event_types
  WHERE key = 'revit_using_plugins' AND is_active = true;

  IF v_green_pts IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_employee_id
  FROM ws_users
  WHERE email = lower(NEW.user_email) AND is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_idem_key := 'revit_green_' || lower(NEW.user_email) || '_' || NEW.work_date::TEXT;

  INSERT INTO gamification_event_logs (user_id, user_email, event_type, source, event_date, details, idempotency_key)
  VALUES (
    v_employee_id,
    lower(NEW.user_email),
    'revit_using_plugins',
    'revit',
    NEW.work_date,
    jsonb_build_object(
      'plugin_name', NEW.plugin_name,
      'launch_count', NEW.launch_count,
      'plugins', jsonb_build_array(
        jsonb_build_object('plugin_name', NEW.plugin_name, 'launch_count', NEW.launch_count)
      )
    ),
    v_idem_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_event_id;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  -- Повторный плагин в тот же день: дописываем в details.plugins, монеты не начисляем.
  IF v_row_count = 0 THEN
    UPDATE gamification_event_logs
    SET details = jsonb_set(
      details,
      '{plugins}',
      COALESCE(
        details->'plugins',
        jsonb_build_array(jsonb_build_object(
          'plugin_name', details->>'plugin_name',
          'launch_count', (details->>'launch_count')::int
        ))
      ) || jsonb_build_array(jsonb_build_object(
        'plugin_name', NEW.plugin_name,
        'launch_count', NEW.launch_count
      ))
    )
    WHERE idempotency_key = v_idem_key;
    RETURN NEW;
  END IF;

  -- Первый плагин дня: транзакция + баланс.
  INSERT INTO gamification_transactions (user_id, user_email, event_id, coins)
  VALUES (v_employee_id, lower(NEW.user_email), v_event_id, v_green_pts);

  INSERT INTO gamification_balances (user_id, total_coins, updated_at)
  VALUES (v_employee_id, v_green_pts, now())
  ON CONFLICT (user_id) DO UPDATE
    SET total_coins = gamification_balances.total_coins + v_green_pts,
        updated_at  = now();

  RETURN NEW;
END;
$function$;

-- ============================================================
-- 1e. Новый event_type revit_streak_reset
-- Используется VPS-скриптом compute-revit-gamification (phase 1) при
-- финализации просроченных pending. coins=0 — событие-маркер без монет.
-- Аналог WS streak_reset_wrong_status / streak_reset_timetracking и т.п.
-- ============================================================

INSERT INTO gamification_event_types (key, name, coins, is_dynamic_coins, is_active)
VALUES ('revit_streak_reset', 'Стрик Revit сброшен: щит истёк', 0, false, true)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- fn_finalize_expired_revit_pendings — НЕ дропаем в этой миграции.
-- Edge Function sync-plugin-launches всё ещё вызывает её через RPC
-- (supabase/functions/sync-plugin-launches/index.ts:182). Дроп вынесен
-- в отдельную миграцию 041_drop_fn_finalize_expired_revit_pendings.sql,
-- которая применяется после Шага 9 плана (декомиссия Edge Function).
-- ============================================================
