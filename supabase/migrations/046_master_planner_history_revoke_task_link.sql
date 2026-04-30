-- Master planner history view: показывать ссылку на задачу для revoke-событий.
-- У budget_revoked_*, deadline_revoked_l3 и т.п. ws_task_id хранится в details.original_details.ws_task_id,
-- а не в details.ws_task_id, поэтому без обновления COALESCE поля task_name/ws_project_id/ws_l1_id
-- приходят NULL, и UI показывает строку без ссылки.
--
-- Изменения:
-- - В каждой ветке (L3 budget, L2 budget, L3 deadline) расширяем COALESCE для ws_task_id
--   третьим вариантом: details->'original_details'->>'ws_task_id'
-- - Зеркально обновляем JOIN ON, чтобы найти задачу в ws_tasks_l3/ws_tasks_l2
-- Структура колонок и порядок не меняются — CREATE OR REPLACE VIEW проходит без drop.

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
    el.details->'exceeded_task'->>'id',
    el.details->'original_details'->>'ws_task_id'
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
  'budget'::text                                 AS category,
  NULL::date                                      AS planned_end,
  NULL::text                                      AS date_closed
FROM gamification_event_logs el
LEFT JOIN ws_tasks_l3 t3
  ON t3.ws_task_id = COALESCE(
    el.details->>'ws_task_id',
    el.details->'exceeded_task'->>'id',
    el.details->'original_details'->>'ws_task_id'
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
    el.details->'exceeded_task'->>'id',
    el.details->'original_details'->>'ws_task_id'
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
  'budget'::text                                 AS category,
  NULL::date                                      AS planned_end,
  NULL::text                                      AS date_closed
FROM gamification_event_logs el
LEFT JOIN ws_tasks_l2 t2
  ON t2.ws_task_id = COALESCE(
    el.details->>'ws_task_id',
    el.details->'exceeded_task'->>'id',
    el.details->'original_details'->>'ws_task_id'
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
  COALESCE(
    el.details->>'ws_task_id',
    el.details->'original_details'->>'ws_task_id'
  )                                               AS ws_task_id,
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
  'deadline'::text                               AS category,
  (el.details->>'planned_end')::date              AS planned_end,
  el.details->>'date_closed'                      AS date_closed
FROM gamification_event_logs el
LEFT JOIN ws_tasks_l3 t3
  ON t3.ws_task_id = COALESCE(
    el.details->>'ws_task_id',
    el.details->'original_details'->>'ws_task_id'
  )
LEFT JOIN ws_tasks_l2 t2
  ON t2.ws_task_id = t3.parent_l2_id
LEFT JOIN gamification_transactions tr
  ON tr.event_id = el.id
WHERE el.event_type IN ('deadline_ok_l3', 'deadline_revoked_l3');
