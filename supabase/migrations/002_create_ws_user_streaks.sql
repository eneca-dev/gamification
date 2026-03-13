-- Таблица хранимых стриков пользователей WS
-- Обновляется compute-gamification ежедневно:
--   green_day  → current_streak += 1
--   red_day    → current_streak = 0
--   absent     → без изменений (не ломает стрик, не считается в длину)

CREATE TABLE IF NOT EXISTS ws_user_streaks (
  user_id        uuid PRIMARY KEY REFERENCES ws_users(id),
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- RLS: только service_role (Edge Functions)
ALTER TABLE ws_user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON ws_user_streaks
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Типы событий стриков WS
INSERT INTO gamification_event_types (key, coins, description, is_active)
VALUES
  ('ws_streak_7',  25,  'Бонус за стрик 7 зелёных дней (WS тайм-трекинг)', true),
  ('ws_streak_30', 100, 'Бонус за стрик 30 зелёных дней (WS тайм-трекинг)', true),
  ('ws_streak_90', 300, 'Бонус за стрик 90 зелёных дней (WS тайм-трекинг)', true)
ON CONFLICT (key) DO NOTHING;
