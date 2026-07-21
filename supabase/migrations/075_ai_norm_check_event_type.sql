-- Event type для ИИ-нормоконтроля. is_active=false — монеты не начисляются до явного включения.
INSERT INTO gamification_event_types (key, name, coins, is_dynamic_coins, is_active)
VALUES ('ai_norm_check_monthly', 'ИИ-нормоконтроль: использование в месяц', 200, false, false)
ON CONFLICT (key) DO NOTHING;

-- RLS на ai_norm_checks — только service_role (паттерн как у ws_user_streaks).
ALTER TABLE ai_norm_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON ai_norm_checks
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
