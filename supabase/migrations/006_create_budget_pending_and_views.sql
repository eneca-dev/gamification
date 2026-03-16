-- Таблица 13: budget_pending — задачи, ожидающие 30-дневной проверки бюджета
-- Управляется compute-gamification

CREATE TABLE IF NOT EXISTS budget_pending (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ws_task_l2_id  text NULL REFERENCES ws_tasks_l2(ws_task_id),
  ws_task_l3_id  text NULL REFERENCES ws_tasks_l3(ws_task_id),
  assignee_id    uuid NOT NULL REFERENCES ws_users(id),
  assignee_email text NOT NULL,
  closed_at      timestamptz NOT NULL,
  eligible_date  date NOT NULL,
  status         text NOT NULL DEFAULT 'pending',
  checked_at     timestamptz NULL,

  -- Ровно один из двух FK должен быть заполнен
  CONSTRAINT chk_one_task CHECK (
    (ws_task_l2_id IS NOT NULL AND ws_task_l3_id IS NULL)
    OR (ws_task_l2_id IS NULL AND ws_task_l3_id IS NOT NULL)
  ),
  CONSTRAINT chk_status CHECK (status IN ('pending', 'approved', 'revoked'))
);

-- Задача не должна дублироваться в pending
CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_pending_l2
  ON budget_pending (ws_task_l2_id) WHERE ws_task_l2_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_pending_l3
  ON budget_pending (ws_task_l3_id) WHERE ws_task_l3_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_budget_pending_status
  ON budget_pending (status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_budget_pending_assignee
  ON budget_pending (assignee_id);

ALTER TABLE budget_pending ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON budget_pending
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- View 14: view_user_transactions — полная история начислений/списаний
CREATE OR REPLACE VIEW view_user_transactions AS
SELECT
  t.user_id,
  t.user_email,
  e.event_date,
  e.event_type,
  e.source,
  t.coins,
  et.description,
  e.details,
  t.created_at
FROM gamification_transactions t
JOIN gamification_event_logs e ON e.id = t.event_id
JOIN gamification_event_types et ON et.key = e.event_type;

-- View 15: view_budget_pending_status — ожидающие и завершённые проверки бюджета
CREATE OR REPLACE VIEW view_budget_pending_status AS
SELECT
  bp.assignee_id AS user_id,
  bp.assignee_email AS user_email,
  bp.status,
  CASE
    WHEN bp.ws_task_l3_id IS NOT NULL THEN 'L3'
    ELSE 'L2'
  END AS level,
  bp.ws_task_l2_id,
  bp.ws_task_l3_id,
  COALESCE(l3.ws_project_id, l2.ws_project_id) AS ws_project_id,
  l2.parent_l1_id AS ws_l1_id,
  COALESCE(l3.name, l2.name) AS task_name,
  p.name AS project_name,
  COALESCE(l3.max_time, l2.max_time) AS max_time,
  COALESCE(ah.total_hours, 0) AS actual_hours,
  COALESCE(ah.total_hours, 0) <= COALESCE(l3.max_time, l2.max_time) AS within_budget,
  bp.closed_at,
  bp.eligible_date,
  CASE
    WHEN bp.status = 'pending' THEN (bp.eligible_date - CURRENT_DATE)
    ELSE NULL
  END AS days_remaining,
  CASE
    WHEN bp.ws_task_l3_id IS NOT NULL THEN (SELECT coins FROM gamification_event_types WHERE key = 'budget_ok_l3')
    ELSE (SELECT coins FROM gamification_event_types WHERE key = 'budget_ok_l2')
  END AS expected_coins,
  bp.checked_at
FROM budget_pending bp
LEFT JOIN ws_tasks_l3 l3 ON l3.ws_task_id = bp.ws_task_l3_id
LEFT JOIN ws_tasks_l2 l2 ON l2.ws_task_id = COALESCE(bp.ws_task_l2_id, l3.parent_l2_id)
LEFT JOIN ws_projects p ON p.ws_project_id = COALESCE(l3.ws_project_id, l2.ws_project_id)
LEFT JOIN ws_task_actual_hours ah ON ah.ws_task_id = COALESCE(bp.ws_task_l3_id, bp.ws_task_l2_id);
