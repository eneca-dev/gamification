-- View с актуальным значением WS-стрика, считаемым на чтение.
--
-- Зачем:
-- В таблице ws_user_streaks current_streak обновляется только в момент vps-прогона
-- (compute-gamification) и только на зелёных днях, через формулу calendar_days − absence_days.
-- Скрипт скипает выходные, поэтому значение в таблице "застывает" на старом до следующего
-- зелёного дня. Pending-сброс тоже финализируется только при прогоне скрипта,
-- из-за чего после красного дня и выходного стрик в таблице остаётся неправильным
-- до утра следующего рабочего дня.
--
-- View считает стрик в реальном времени по модели:
--   green   → +1
--   absent  → 0 (заморозка)
--   red     → 0 (защитный fallback; в норме не встречается внутри окна)
--   нет записи (выходной/праздник) → +1
--
-- Pending grace: пока pending_reset_expires_at > now() панель показывает
-- замороженное значение из таблицы. После истечения грейса — пересчитанное.

CREATE OR REPLACE VIEW ws_user_streaks_effective
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
      WHEN ds.status = 'red'    THEN 0
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
