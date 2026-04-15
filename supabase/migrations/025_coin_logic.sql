-- 025_coin_logic.sql
-- Две новые механики: штраф за отчёт не в статусе «В работе» и бонус за закрытие в срок

-- 1. Кастомный статус задач L3 (тег из набора «Система планирования»)
ALTER TABLE ws_tasks_l3 ADD COLUMN custom_status text NULL;

-- 2. Плановая дата завершения задач L3
ALTER TABLE ws_tasks_l3 ADD COLUMN date_end date NULL;

-- 3. История смен статусов (из WS API get_events)
CREATE TABLE ws_task_status_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ws_task_id text NOT NULL,
  old_status text NULL,
  new_status text NULL,
  changed_at timestamptz NOT NULL,
  changed_by_email text NULL,
  event_date date NOT NULL,
  synced_at timestamptz DEFAULT now()
);

CREATE INDEX idx_task_status_changes_date ON ws_task_status_changes(event_date);
CREATE INDEX idx_task_status_changes_task ON ws_task_status_changes(ws_task_id, event_date);

-- 4. Детализация cost entries по задачам (какой юзер в какую задачу внёс часы за день)
CREATE TABLE ws_daily_report_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  user_id uuid REFERENCES ws_users(id),
  ws_task_id text NOT NULL,
  cost_date date NOT NULL,
  hours numeric NOT NULL,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(user_email, ws_task_id, cost_date)
);

-- 5. Pending-таблица для проверки дедлайнов (аналог budget_pending)
CREATE TABLE deadline_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ws_task_l3_id text REFERENCES ws_tasks_l3(ws_task_id),
  assignee_id uuid NOT NULL REFERENCES ws_users(id),
  assignee_email text NOT NULL,
  closed_at timestamptz NOT NULL,
  planned_end date NOT NULL,
  eligible_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'revoked')),
  checked_at timestamptz NULL
);

-- 6. Новые event types
INSERT INTO gamification_event_types (key, name, coins, description, is_active) VALUES
  ('wrong_status_report', 'Отчёт в неверном статусе задачи', -3, 'Время внесено в задачу L3 не в статусе «В работе»', true),
  ('deadline_ok_l3', 'Задача L3 закрыта в срок', 3, 'Задача закрыта до плановой даты (проверка через 30 дней)', true),
  ('deadline_revoked_l3', 'Отзыв бонуса за срок L3', -3, 'Бонус за срок отозван: задача переоткрыта после approval', true);
