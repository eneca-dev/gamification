-- 054_crystal_rates_and_byn.sql
-- Crystal-to-BYN exchange rate history + byn_amount on transactions + cost_byn/coefficient on products.
-- Initial rate: 80 crystals = 1 BYN.
-- Source-of-truth: latest row in crystal_rates is the active rate.

-- 1. Курс кристаллов с историей
CREATE TABLE IF NOT EXISTS crystal_rates (
  id          bigserial PRIMARY KEY,
  rate        numeric(8,4) NOT NULL CHECK (rate > 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES ws_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_crystal_rates_created_at
  ON crystal_rates (created_at DESC);

-- Стартовый курс: 80 кристаллов = 1 BYN
INSERT INTO crystal_rates (rate, created_by)
SELECT 80, NULL
WHERE NOT EXISTS (SELECT 1 FROM crystal_rates);

-- RLS: защита от прямой записи клиентом (admin-actions используют supabaseAdmin/service_role)
ALTER TABLE crystal_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated users can read crystal_rates" ON crystal_rates;
CREATE POLICY "authenticated users can read crystal_rates"
  ON crystal_rates FOR SELECT TO authenticated USING (true);

-- 2. Хелпер: текущий курс = последняя запись
CREATE OR REPLACE FUNCTION current_crystal_rate() RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rate FROM crystal_rates ORDER BY id DESC LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION current_crystal_rate() TO authenticated, service_role;

-- 3. byn_amount в gamification_transactions + backfill по стартовому курсу
ALTER TABLE gamification_transactions
  ADD COLUMN IF NOT EXISTS byn_amount numeric(12,2);

UPDATE gamification_transactions
   SET byn_amount = round(coins::numeric / 80, 2)
 WHERE byn_amount IS NULL;

CREATE INDEX IF NOT EXISTS idx_gamification_transactions_byn_amount
  ON gamification_transactions (byn_amount)
  WHERE byn_amount IS NOT NULL;

-- 4. cost_byn + coefficient на товарах + backfill из существующего price
ALTER TABLE shop_products
  ADD COLUMN IF NOT EXISTS cost_byn    numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coefficient numeric(5,2)  NOT NULL DEFAULT 1.0
    CHECK (coefficient > 0);

UPDATE shop_products
   SET cost_byn = round(price::numeric / 80, 2)
 WHERE cost_byn = 0 AND price IS NOT NULL;

-- Колонка price не удаляется здесь — её удалит миграция 056 (после переписывания purchase_product).
-- Между этапами 1 и 3 покупки продолжают работать со старой ценой в кристаллах.
