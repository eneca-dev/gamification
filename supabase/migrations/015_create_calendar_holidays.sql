-- Таблица праздников / нерабочих дней (администраторы задают заранее)
CREATE TABLE calendar_holidays (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date        date NOT NULL UNIQUE,
  name        text NOT NULL,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_calendar_holidays_date ON calendar_holidays (date);

ALTER TABLE calendar_holidays ENABLE ROW LEVEL SECURITY;

-- Все авторизованные могут читать
CREATE POLICY "authenticated users can read calendar_holidays"
  ON calendar_holidays FOR SELECT TO authenticated USING (true);

-- Только админы ws_users могут вставлять/обновлять/удалять
CREATE POLICY "admins can manage calendar_holidays"
  ON calendar_holidays FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM ws_users WHERE ws_users.user_id = auth.uid() AND ws_users.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM ws_users WHERE ws_users.user_id = auth.uid() AND ws_users.is_admin = true)
  );
