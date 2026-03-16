-- View 8: Дневной статус пользователя (green / red / absent)
-- Приоритет: absent > red > green
-- absent всегда перекрывает red (даже если есть нарушения)

CREATE OR REPLACE VIEW view_daily_statuses AS
WITH
  -- Все рабочие дни из daily_reports + absences (объединяем даты)
  user_dates AS (
    SELECT user_id, user_email, report_date AS date FROM ws_daily_reports WHERE user_id IS NOT NULL
    UNION
    SELECT user_id, user_email, absence_date AS date FROM ws_user_absences WHERE user_id IS NOT NULL
  ),

  -- Отсутствия
  absences AS (
    SELECT user_id, absence_date, absence_type
    FROM ws_user_absences
    WHERE user_id IS NOT NULL
  ),

  -- Наличие отчёта за день
  reports AS (
    SELECT user_id, report_date
    FROM ws_daily_reports
    WHERE user_id IS NOT NULL
  ),

  -- Негативные события из лога (source = 'ws')
  negative_events AS (
    SELECT user_id, event_date, array_agg(event_type) AS red_reasons
    FROM gamification_event_logs
    WHERE source = 'ws'
      AND event_type IN ('red_day', 'task_dynamics_violation', 'section_red')
    GROUP BY user_id, event_date
  )

SELECT
  ud.user_id,
  ud.user_email,
  ud.date,
  CASE
    WHEN a.absence_date IS NOT NULL THEN 'absent'
    WHEN r.report_date IS NULL THEN 'red'
    WHEN ne.red_reasons IS NOT NULL THEN 'red'
    ELSE 'green'
  END AS status,
  a.absence_type,
  CASE
    WHEN a.absence_date IS NOT NULL THEN NULL
    WHEN r.report_date IS NULL THEN ARRAY['red_day']::text[]
    WHEN ne.red_reasons IS NOT NULL THEN ne.red_reasons
    ELSE NULL
  END AS red_reasons
FROM user_dates ud
LEFT JOIN absences a ON a.user_id = ud.user_id AND a.absence_date = ud.date
LEFT JOIN reports r ON r.user_id = ud.user_id AND r.report_date = ud.date
LEFT JOIN negative_events ne ON ne.user_id = ud.user_id AND ne.event_date = ud.date;
