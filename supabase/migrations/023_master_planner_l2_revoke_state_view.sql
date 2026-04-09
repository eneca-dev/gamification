-- Мастер планирования: L2-стрик, revoke-логика, таблица состояния, вью истории
-- См. src/docs-features/ws-gamification/master-planner-panel.md

-- ═══════════════════════════════════════════════════════════════════
-- 1. Новые event types
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO gamification_event_types (key, name, coins, description)
VALUES
  ('master_planner_l2',         'Мастер планирования L2',         400,  'Мастер планирования L2: 10 задач подряд в бюджете'),
  ('master_planner_l2_reset',   'Сброс серии мастера L2',         0,    'Сброс серии мастера планирования L2'),
  ('master_planner_revoked',    'Отзыв бонуса мастера L3',       -450,  'Отзыв бонуса мастера планирования L3'),
  ('master_planner_l2_revoked', 'Отзыв бонуса мастера L2',       -400,  'Отзыв бонуса мастера планирования L2')
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Таблица состояния (скрипт upsert-ит, Next.js читает)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS master_planner_state (
  user_id          uuid    NOT NULL REFERENCES profiles(user_id),
  level            text    NOT NULL CHECK (level IN ('l3', 'l2')),
  current_streak   integer NOT NULL DEFAULT 0,
  completed_cycles integer NOT NULL DEFAULT 0,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, level)
);

-- RLS: сервис-роль пишет, авторизованные пользователи читают свои строки
ALTER TABLE master_planner_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on master_planner_state"
  ON master_planner_state
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can read own master_planner_state"
  ON master_planner_state
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════
-- 3. Вью: view_master_planner_history
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW view_master_planner_history AS

-- L3 события
SELECT
  el.id                                           AS event_id,
  el.user_id,
  el.user_email,
  el.event_type,
  el.event_date,
  el.created_at,
  'L3'::text                                     AS level,
  -- Задача: для budget-событий — ws_task_id, для reset — exceeded_task.id
  COALESCE(
    el.details->>'ws_task_id',
    el.details->'exceeded_task'->>'id'
  )                                               AS ws_task_id,
  t3.name                                         AS task_name,
  t3.ws_project_id,
  t2_parent.parent_l1_id                          AS ws_l1_id,
  (el.details->>'max_time')::numeric              AS max_time,
  (el.details->>'actual_time')::numeric           AS actual_time,
  (el.details->>'streak_was')::integer            AS streak_was,
  (el.details->>'milestone')::integer             AS milestone,
  el.details->'tasks'                             AS milestone_tasks,
  (el.details->>'expected')::integer              AS revoke_expected,
  (el.details->>'given')::integer                 AS revoke_given,
  el.details->'revoked_tasks'                     AS revoked_tasks,
  tr.coins
FROM gamification_event_logs el
LEFT JOIN ws_tasks_l3 t3
  ON t3.ws_task_id = COALESCE(
    el.details->>'ws_task_id',
    el.details->'exceeded_task'->>'id'
  )
LEFT JOIN ws_tasks_l2 t2_parent
  ON t2_parent.ws_task_id = t3.parent_l2_id
LEFT JOIN gamification_transactions tr
  ON tr.event_id = el.id
WHERE el.event_type IN (
  'budget_ok_l3', 'budget_exceeded_l3', 'budget_revoked_l3',
  'master_planner', 'master_planner_reset', 'master_planner_revoked'
)

UNION ALL

-- L2 события
SELECT
  el.id                                           AS event_id,
  el.user_id,
  el.user_email,
  el.event_type,
  el.event_date,
  el.created_at,
  'L2'::text                                     AS level,
  COALESCE(
    el.details->>'ws_task_id',
    el.details->'exceeded_task'->>'id'
  )                                               AS ws_task_id,
  t2.name                                         AS task_name,
  t2.ws_project_id,
  t2.parent_l1_id                                 AS ws_l1_id,
  (el.details->>'max_time')::numeric              AS max_time,
  (el.details->>'actual_time')::numeric           AS actual_time,
  (el.details->>'streak_was')::integer            AS streak_was,
  (el.details->>'milestone')::integer             AS milestone,
  el.details->'tasks'                             AS milestone_tasks,
  (el.details->>'expected')::integer              AS revoke_expected,
  (el.details->>'given')::integer                 AS revoke_given,
  el.details->'revoked_tasks'                     AS revoked_tasks,
  tr.coins
FROM gamification_event_logs el
LEFT JOIN ws_tasks_l2 t2
  ON t2.ws_task_id = COALESCE(
    el.details->>'ws_task_id',
    el.details->'exceeded_task'->>'id'
  )
LEFT JOIN gamification_transactions tr
  ON tr.event_id = el.id
WHERE el.event_type IN (
  'budget_ok_l2', 'budget_exceeded_l2', 'budget_revoked_l2',
  'master_planner_l2', 'master_planner_l2_reset', 'master_planner_l2_revoked'
);
