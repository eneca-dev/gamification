-- Дашборд внедрения геймификации (/admin/adoption): ретроспективный бэкфил
-- вердиктов за 29–30 июня 2026 (два рабочих дня до запуска).
--
-- Отдельная таблица только для аналитики: система её не читает, ws_daily_statuses
-- не изменяется. Вердикты вычислены по той же логике, что VPS-скрипт: absent —
-- из ws_user_absences; red_day — нет строки в ws_daily_reports (своевременного
-- отчёта); wrong_status_report — часы списаны в задачу, не находившуюся в статусе
-- «В работе» на дату списания (статус на дату восстановлен из ws_task_status_changes).
--
-- Заполняется один раз; идемпотентна (IF NOT EXISTS + ON CONFLICT DO NOTHING).

CREATE TABLE IF NOT EXISTS ws_daily_statuses_baseline (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,           -- ws_users.id
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('green', 'red', 'absent')),
  red_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (user_id, date)
);

COMMENT ON TABLE ws_daily_statuses_baseline IS
  'Ретроспективные вердикты green/red за 29–30.06.2026 (до запуска геймификации). Только для /admin/adoption; заполнена один раз миграцией, системой не используется и не обновляется.';

ALTER TABLE ws_daily_statuses_baseline ENABLE ROW LEVEL SECURITY;

WITH days AS (
  SELECT unnest(ARRAY['2026-06-29', '2026-06-30']::date[]) AS day
),
base AS (
  SELECT
    u.id AS user_id,
    d.day,
    EXISTS (
      SELECT 1 FROM ws_user_absences a
      WHERE a.user_id = u.id AND a.absence_date = d.day
    ) AS is_absent,
    NOT EXISTS (
      SELECT 1 FROM ws_daily_reports r
      WHERE r.user_id = u.id AND r.report_date = d.day
    ) AS no_report,
    EXISTS (
      SELECT 1 FROM ws_daily_report_tasks drt
      WHERE drt.user_id = u.id AND drt.cost_date = d.day
        AND COALESCE(
          (SELECT sc.new_status FROM ws_task_status_changes sc
            WHERE sc.ws_task_id = drt.ws_task_id AND sc.event_date <= d.day
            ORDER BY sc.event_date DESC, sc.changed_at DESC LIMIT 1),
          (SELECT sc.old_status FROM ws_task_status_changes sc
            WHERE sc.ws_task_id = drt.ws_task_id
            ORDER BY sc.event_date ASC, sc.changed_at ASC LIMIT 1),
          (SELECT t.custom_status FROM ws_tasks_l3 t
            WHERE t.ws_task_id = drt.ws_task_id LIMIT 1)
        ) IS DISTINCT FROM 'В работе'
    ) AS wrong_status
  FROM ws_users u
  CROSS JOIN days d
  WHERE u.is_active = true
)
INSERT INTO ws_daily_statuses_baseline (user_id, date, status, red_reasons)
SELECT
  user_id,
  day,
  CASE
    WHEN is_absent THEN 'absent'
    WHEN no_report OR wrong_status THEN 'red'
    ELSE 'green'
  END,
  CASE
    WHEN is_absent THEN '[]'::jsonb
    ELSE
      (CASE WHEN no_report
        THEN jsonb_build_array(jsonb_build_object('type', 'red_day'))
        ELSE '[]'::jsonb END)
      ||
      (CASE WHEN wrong_status
        THEN jsonb_build_array(jsonb_build_object('type', 'wrong_status_report'))
        ELSE '[]'::jsonb END)
  END
FROM base
ON CONFLICT (user_id, date) DO NOTHING;
