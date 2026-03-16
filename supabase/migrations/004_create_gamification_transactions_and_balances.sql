-- Таблица 11: История начислений/списаний коинов
-- Каждая транзакция привязана к событию из gamification_event_logs
-- Стоимость фиксируется из gamification_event_types на момент создания

CREATE TABLE IF NOT EXISTS gamification_transactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(user_id),
  user_email text NOT NULL,
  event_id   uuid NOT NULL REFERENCES gamification_event_logs(id),
  coins      integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gamification_transactions_user
  ON gamification_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gamification_transactions_event
  ON gamification_transactions (event_id);

ALTER TABLE gamification_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON gamification_transactions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Таблица 12: Материализованный баланс коинов
-- Кэш для быстрого чтения (профиль, лидерборд, магазин)
-- Обновляется атомарно вместе с INSERT в gamification_transactions

CREATE TABLE IF NOT EXISTS gamification_balances (
  user_id     uuid PRIMARY KEY REFERENCES profiles(user_id),
  total_coins integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gamification_balances_coins
  ON gamification_balances (total_coins DESC);

ALTER TABLE gamification_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON gamification_balances
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
