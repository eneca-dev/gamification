-- ============================================================
-- Миграция: Вторая жизнь (Streak Shield)
-- Пользователь может купить защиту стрика в течение 24ч после красного дня
-- ============================================================

-- 1. Колонка effect в shop_products (определяет спецэффект товара при покупке)
ALTER TABLE shop_products ADD COLUMN effect text NULL;

-- 2. Pending-колонки в ws_user_streaks
ALTER TABLE ws_user_streaks
  ADD COLUMN pending_reset_date date NULL,
  ADD COLUMN pending_reset_expires_at timestamptz NULL;

-- 3. Pending-колонки в revit_user_streaks
ALTER TABLE revit_user_streaks
  ADD COLUMN pending_reset_date date NULL,
  ADD COLUMN pending_reset_expires_at timestamptz NULL,
  ADD COLUMN pending_gap_days integer NULL;

-- 4. Таблица-лог использований второй жизни
CREATE TABLE streak_shield_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES ws_users(id),
  shield_type    text NOT NULL CHECK (shield_type IN ('ws', 'revit')),
  protected_date date NOT NULL,
  order_id       uuid NOT NULL REFERENCES shop_orders(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE streak_shield_log ENABLE ROW LEVEL SECURITY;

-- RLS: пользователь видит свои записи
CREATE POLICY "Users can read own shield log"
  ON streak_shield_log FOR SELECT TO authenticated
  USING (user_id = public.my_ws_user_id());

-- RLS: админы видят все
CREATE POLICY "Admins can read all shield logs"
  ON streak_shield_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ws_users
      WHERE ws_users.id = public.my_ws_user_id()
        AND ws_users.is_admin = true
    )
  );

-- RLS: service_role — полный доступ (для server actions)
CREATE POLICY "Service role full access on streak_shield_log"
  ON streak_shield_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 5. Тип события
INSERT INTO gamification_event_types (key, name, coins, is_dynamic_coins, is_active)
VALUES ('streak_shield_used', 'Использование второй жизни', 0, false, true)
ON CONFLICT (key) DO NOTHING;

-- 6. Товары — Вторая жизнь (категория artifact)
INSERT INTO shop_products (name, description, price, category_id, effect, emoji, is_active, stock, sort_order)
VALUES
  (
    'Вторая жизнь: Дисциплина',
    'Спасает стрик Worksection при красном дне. Можно купить только в течение 24 часов после красного дня.',
    100,
    'dec43fed-85a5-4a4e-9257-f68e3950fb3d',
    'streak_shield_ws',
    '🛡️',
    true,
    NULL,
    10
  ),
  (
    'Вторая жизнь: Автоматизация',
    'Спасает стрик Revit при пропуске использования плагинов. Можно купить только в течение 24 часов после пропуска.',
    100,
    'dec43fed-85a5-4a4e-9257-f68e3950fb3d',
    'streak_shield_revit',
    '🛡️',
    true,
    NULL,
    11
  );
