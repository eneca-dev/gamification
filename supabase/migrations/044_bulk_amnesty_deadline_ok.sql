-- Миграция 044: добивка амнистии для deadline_ok_l3 через deadline_pending
--
-- В миграции 043 фильтр шёл через budget_pending, и события deadline_ok_l3 за L3-задачи
-- БЕЗ бюджета (только дедлайн) остались неотозванными. Эти задачи отслеживаются в
-- отдельной таблице deadline_pending. Их 427 событий на 1 281 💎 у 165 юзеров.
--
-- Логика идентична 043: для каждого события в окне 22-25.04 за задачу с
-- deadline_pending.closed_at < 2026-03-25 пишется revoked-событие через
-- process_gamification_event с -coins. Idempotency защищает от повторного применения.

DO $$
DECLARE
  r RECORD;
  v_processed int := 0;
BEGIN
  CREATE TEMP TABLE deadline_targets ON COMMIT DROP AS
  WITH deadline_old AS (
    SELECT DISTINCT ws_task_l3_id FROM deadline_pending
    WHERE closed_at < '2026-03-25'
  )
  SELECT e.id, e.user_id, e.user_email, e.event_type, e.details, t.coins
  FROM gamification_event_logs e
  JOIN gamification_transactions t ON t.event_id = e.id
  WHERE e.source = 'ws'
    AND e.event_type = 'deadline_ok_l3'
    AND e.event_date BETWEEN '2026-04-22' AND '2026-04-25'
    AND (e.details->>'ws_task_id') IN (SELECT ws_task_l3_id FROM deadline_old)
    AND NOT EXISTS (
      SELECT 1 FROM gamification_event_logs e2
      WHERE e2.idempotency_key = 'bulk_amnesty_' || e.id::text
    );

  FOR r IN SELECT * FROM deadline_targets LOOP
    PERFORM process_gamification_event(
      r.user_id,
      r.user_email,
      'deadline_revoked_l3',
      'ws',
      fn_minsk_today(),
      jsonb_build_object(
        'amnesty', true,
        'reason', 'bulk_pending_2026_04_22_deadline',
        'original_event_id', r.id,
        'original_event_type', r.event_type,
        'original_details', r.details
      ),
      'bulk_amnesty_' || r.id::text,
      -r.coins
    );
    v_processed := v_processed + 1;
  END LOOP;

  RAISE NOTICE 'Deadline amnesty: processed % events', v_processed;
END $$;

-- Добиваем orphan-транзакции (на случай если у кого-то баланс упал в 0 в процессе)
INSERT INTO gamification_transactions (user_id, user_email, event_id, coins)
SELECT
  e.user_id,
  e.user_email,
  e.id,
  -t_orig.coins
FROM gamification_event_logs e
LEFT JOIN gamification_transactions t ON t.event_id = e.id
JOIN gamification_transactions t_orig ON t_orig.event_id = (e.details->>'original_event_id')::uuid
WHERE e.idempotency_key LIKE 'bulk_amnesty_%'
  AND e.details->>'reason' = 'bulk_pending_2026_04_22_deadline'
  AND t.event_id IS NULL;

REFRESH MATERIALIZED VIEW view_top_pers_ws;
REFRESH MATERIALIZED VIEW view_top_team_ws;
REFRESH MATERIALIZED VIEW view_top_dept_ws;
