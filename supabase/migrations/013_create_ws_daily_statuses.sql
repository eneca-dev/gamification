-- Таблица ws_daily_statuses: source of truth для статусов дней
-- Заполняется VPS-скриптом compute-gamification (upsert по user_id + date)
-- Заменяет view_daily_statuses как основной источник для грида

CREATE TABLE IF NOT EXISTS ws_daily_statuses (
  user_id       uuid        NOT NULL REFERENCES ws_users(id) ON DELETE CASCADE,
  date          date        NOT NULL,
  status        text        NOT NULL CHECK (status IN ('green', 'red', 'absent')),
  absence_type  text,
  red_reasons   text[],
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_ws_daily_statuses_user_date
  ON ws_daily_statuses (user_id, date);

-- RLS: доступ только service role
ALTER TABLE ws_daily_statuses ENABLE ROW LEVEL SECURITY;
