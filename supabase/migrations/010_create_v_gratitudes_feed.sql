-- View: благодарности с именем отправителя и флагом earned_coins
-- earned_coins > 0 если благодарность была первой от отправителя за неделю
-- (определяется наличием записи в gamification_event_logs/transactions)
CREATE OR REPLACE VIEW v_gratitudes_feed AS
SELECT
  g.id,
  g.sender_email,
  COALESCE(ws.first_name || ' ' || ws.last_name, g.sender_email) AS sender_name,
  g.recipient_email,
  g.recipient_name,
  g.message,
  g.airtable_created_at,
  g.week_start,
  COALESCE(t.coins, 0) AS earned_coins
FROM at_gratitudes g
LEFT JOIN ws_users ws ON ws.email = g.sender_email
LEFT JOIN gamification_event_logs e
  ON e.event_type = 'gratitude_recipient_points'
  AND e.details->>'gratitude_id' = g.id
LEFT JOIN gamification_transactions t ON t.event_id = e.id
WHERE g.deleted_in_airtable = false;
