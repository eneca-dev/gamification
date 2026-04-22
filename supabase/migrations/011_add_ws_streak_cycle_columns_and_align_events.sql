-- 1. Новые колонки в ws_user_streaks для 90-дневного цикла
ALTER TABLE ws_user_streaks
  ADD COLUMN IF NOT EXISTS streak_start_date date,
  ADD COLUMN IF NOT EXISTS completed_cycles integer NOT NULL DEFAULT 0;

-- 2. green_day: 0 → 3 💎
UPDATE gamification_event_types SET coins = 3, updated_at = now() WHERE key = 'green_day';

-- 3. Бонус тимлиду L2 за закрытие дочерней L3 в бюджете (+5)
INSERT INTO gamification_event_types (key, coins, description)
VALUES ('budget_ok_l3_lead_bonus', 5, 'Бонус тимлиду L2 за закрытие дочерней L3 в бюджете')
ON CONFLICT (key) DO NOTHING;

-- 4. Отзыв бонуса тимлиду L2 (−5)
INSERT INTO gamification_event_types (key, coins, description)
VALUES ('budget_revoked_l3_lead', -5, 'Отзыв бонуса тимлиду L2: бюджет дочерней L3 превышен после одобрения')
ON CONFLICT (key) DO NOTHING;
