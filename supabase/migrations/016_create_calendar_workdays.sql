-- Рабочие дни-переносы (когда выходной становится рабочим)
CREATE TABLE calendar_workdays (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date        date NOT NULL UNIQUE,
  name        text NOT NULL,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_calendar_workdays_date ON calendar_workdays (date);

ALTER TABLE calendar_workdays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read calendar_workdays"
  ON calendar_workdays FOR SELECT TO authenticated USING (true);

CREATE POLICY "admins can manage calendar_workdays"
  ON calendar_workdays FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM ws_users WHERE ws_users.user_id = auth.uid() AND ws_users.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM ws_users WHERE ws_users.user_id = auth.uid() AND ws_users.is_admin = true)
  );
