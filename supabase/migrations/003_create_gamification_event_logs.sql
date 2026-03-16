-- Универсальный лог событий геймификации (все источники)
-- Записи создаются compute-функциями, не удаляются

CREATE TABLE IF NOT EXISTS gamification_event_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(user_id),
  user_email text NOT NULL,
  event_type text NOT NULL REFERENCES gamification_event_types(key),
  source     text NOT NULL,
  event_date date NOT NULL,
  details    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Индексы для частых запросов
CREATE INDEX IF NOT EXISTS idx_gamification_event_logs_user_date
  ON gamification_event_logs (user_id, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_gamification_event_logs_type_date
  ON gamification_event_logs (event_type, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_gamification_event_logs_source
  ON gamification_event_logs (source);

-- RLS: только service_role (Edge Functions)
ALTER TABLE gamification_event_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on event_logs" ON gamification_event_logs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
