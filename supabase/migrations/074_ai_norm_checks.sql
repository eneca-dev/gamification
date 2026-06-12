CREATE TABLE IF NOT EXISTS ai_norm_checks (
  id             bigint PRIMARY KEY,
  user_email     text NOT NULL,
  work_date      date NOT NULL,
  mode           text NOT NULL,
  filename       text,
  pages_count    int,
  mistakes_count int,
  synced_at      timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_norm_checks_user_email_idx ON ai_norm_checks (user_email);
CREATE INDEX IF NOT EXISTS ai_norm_checks_work_date_idx ON ai_norm_checks (work_date);
