-- Миграция 043: компенсация bulk-залпа budget_pending от 22-23.04.2026
--
-- Контекст: 22.04.2026 первый прогон compute-gamification без фильтра по date_closed
-- массово одобрил 1134 события за L2/L3 задачи, закрытые до 1.5 года назад.
-- Фикс PENDING_WINDOW_DAYS=7 внесён 23.04.2026 (vps-scripts commit 2b36bf5),
-- но уже начисленные баллы остались в gamification_transactions.
--
-- Эта миграция компенсирует начисления через process_gamification_event RPC:
--   - positive (budget_ok_*, deadline_ok_l3, master_planner*) → revoked-тип с -coins
--   - negative (budget_revoked_l2, deadline_revoked_l3) → ok-тип с +coins
-- Баланс автоматически клампится до 0 функцией process_gamification_event.
-- Idempotency_key 'bulk_amnesty_{original_event_id}' защищает от повторного применения.
--
-- Цель: события за 2026-04-22..25 источника 'ws':
--   - task-bound: связанные с задачей в budget_pending где closed_at < 2026-03-25
--   - master_planner / master_planner_l2: все за период (априори bulk)

DO $$
DECLARE
  r RECORD;
  v_revoke_type text;
  v_processed int := 0;
BEGIN
  CREATE TEMP TABLE bulk_targets ON COMMIT DROP AS
  WITH affected_tasks AS (
    SELECT DISTINCT ws_task_l2_id AS task_id FROM budget_pending
      WHERE closed_at < '2026-03-25' AND ws_task_l2_id IS NOT NULL
    UNION
    SELECT DISTINCT ws_task_l3_id AS task_id FROM budget_pending
      WHERE closed_at < '2026-03-25' AND ws_task_l3_id IS NOT NULL
  )
  SELECT e.id, e.user_id, e.user_email, e.event_type, e.details, t.coins
  FROM gamification_event_logs e
  JOIN gamification_transactions t ON t.event_id = e.id
  WHERE e.source = 'ws'
    AND e.event_date BETWEEN '2026-04-22' AND '2026-04-25'
    AND (
      (e.event_type IN ('budget_ok_l2','budget_ok_l3','budget_ok_l3_lead_bonus',
                        'deadline_ok_l3','budget_revoked_l2','deadline_revoked_l3')
       AND (e.details->>'ws_task_id') IN (SELECT task_id FROM affected_tasks))
      OR e.event_type IN ('master_planner','master_planner_l2')
    );

  FOR r IN SELECT * FROM bulk_targets LOOP
    v_revoke_type := CASE r.event_type
      WHEN 'budget_ok_l2'              THEN 'budget_revoked_l2'
      WHEN 'budget_ok_l3'              THEN 'budget_revoked_l3'
      WHEN 'budget_ok_l3_lead_bonus'   THEN 'budget_revoked_l3_lead'
      WHEN 'deadline_ok_l3'            THEN 'deadline_revoked_l3'
      WHEN 'master_planner'            THEN 'master_planner_revoked'
      WHEN 'master_planner_l2'         THEN 'master_planner_l2_revoked'
      WHEN 'budget_revoked_l2'         THEN 'budget_ok_l2'
      WHEN 'deadline_revoked_l3'       THEN 'deadline_ok_l3'
    END;

    PERFORM process_gamification_event(
      r.user_id,
      r.user_email,
      v_revoke_type,
      'ws',
      CURRENT_DATE,
      jsonb_build_object(
        'amnesty', true,
        'reason', 'bulk_pending_2026_04_22',
        'original_event_id', r.id,
        'original_event_type', r.event_type,
        'original_details', r.details
      ),
      'bulk_amnesty_' || r.id::text,
      -r.coins
    );
    v_processed := v_processed + 1;
  END LOOP;

  RAISE NOTICE 'Bulk amnesty: processed % events', v_processed;
END $$;

REFRESH MATERIALIZED VIEW view_top_pers_ws;
REFRESH MATERIALIZED VIEW view_top_team_ws;
REFRESH MATERIALIZED VIEW view_top_dept_ws;
