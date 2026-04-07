-- Индекс для фильтрации view_user_transactions по email (826 seq_scan на gamification_transactions)
CREATE INDEX IF NOT EXISTS idx_gamification_transactions_user_email
  ON gamification_transactions(user_email);

-- Индекс для подсчёта достижений по благодарностям (type + created_at)
CREATE INDEX IF NOT EXISTS idx_gratitudes_type_created
  ON gratitudes(type, created_at);
