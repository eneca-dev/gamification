-- Мастер планирования: deadline pending view + расширение history view (category + deadline события)
-- Новые колонки добавляются В КОНЕЦ — требование CREATE OR REPLACE VIEW

-- ═══════════════════════════════════════════════════════════════════
-- 1. view_deadline_pending_status — задачи, ожидающие 30-дневной проверки срока
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW view_deadline_pending_status AS
SELECT
  dp.assignee_id                            AS user_id,
  dp.assignee_email                         AS user_email,
  'L3'::text                               AS level,
  COALESCE(t3.name, '')                    AS task_name,
  t3.ws_project_id,
  t2.parent_l1_id                          AS ws_l1_id,
  dp.ws_task_l3_id,
  dp.planned_end,
  dp.closed_at::date                       AS closed_at,
  (dp.closed_at::date <= dp.planned_end)   AS closed_on_time,
  (dp.eligible_date - CURRENT_DATE)        AS days_remaining,
  3                                        AS expected_coins
FROM deadline_pending dp
LEFT JOIN ws_tasks_l3 t3 ON t3.ws_task_id = dp.ws_task_l3_id
LEFT JOIN ws_tasks_l2 t2 ON t2.ws_task_id = t3.parent_l2_id
WHERE dp.status = 'pending';

-- ═══════════════════════════════════════════════════════════════════
-- 2. view_master_planner_history — расширяем: category, planned_end, date_closed
--    Новые колонки добавлены В КОНЕЦ существующего списка (cols 21-23)
--    Основано на 024_remove_reset_from_master_planner_view.sql
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW view_master_planner_history AS

-- L3 budget события
SELECT
  el.id                                           AS event_id,
  el.user_id,
  el.user_email,
  el.event_type,
  el.event_date,
  el.created_at,
  'L3'::text                                     AS level,
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
  tr.coins,
  -- Новые колонки в конце
  'budget'::text                                 AS category,
  NULL::date                                      AS planned_end,
  NULL::text                                      AS date_closed
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
  'master_planner', 'master_planner_revoked'
)

UNION ALL

-- L2 budget события
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
  tr.coins,
  -- Новые колонки в конце
  'budget'::text                                 AS category,
  NULL::date                                      AS planned_end,
  NULL::text                                      AS date_closed
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
  'master_planner_l2', 'master_planner_l2_revoked'
)

UNION ALL

-- L3 deadline события
SELECT
  el.id                                           AS event_id,
  el.user_id,
  el.user_email,
  el.event_type,
  el.event_date,
  el.created_at,
  'L3'::text                                     AS level,
  el.details->>'ws_task_id'                      AS ws_task_id,
  t3.name                                         AS task_name,
  t3.ws_project_id,
  t2.parent_l1_id                                 AS ws_l1_id,
  NULL::numeric                                   AS max_time,
  NULL::numeric                                   AS actual_time,
  NULL::integer                                   AS streak_was,
  NULL::integer                                   AS milestone,
  NULL::jsonb                                     AS milestone_tasks,
  NULL::integer                                   AS revoke_expected,
  NULL::integer                                   AS revoke_given,
  NULL::jsonb                                     AS revoked_tasks,
  tr.coins,
  -- Новые колонки в конце
  'deadline'::text                               AS category,
  (el.details->>'planned_end')::date              AS planned_end,
  el.details->>'date_closed'                      AS date_closed
FROM gamification_event_logs el
LEFT JOIN ws_tasks_l3 t3
  ON t3.ws_task_id = el.details->>'ws_task_id'
LEFT JOIN ws_tasks_l2 t2
  ON t2.ws_task_id = t3.parent_l2_id
LEFT JOIN gamification_transactions tr
  ON tr.event_id = el.id
WHERE el.event_type IN ('deadline_ok_l3', 'deadline_revoked_l3');
