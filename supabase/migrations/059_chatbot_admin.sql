-- Колонка для управления видимостью статьи в пользовательской справке.
-- show_in_help = false → статья чанкуется для RAG, но не отображается в /help.
ALTER TABLE help_articles
  ADD COLUMN show_in_help BOOLEAN NOT NULL DEFAULT true;

-- Лог запусков векторизации — для отображения статуса в HelpEditor.
CREATE TABLE chatbot_reembed_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status      TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'error')),
  error       TEXT
);

ALTER TABLE chatbot_reembed_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read reembed log"
  ON chatbot_reembed_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ws_users
      WHERE ws_users.id = public.my_ws_user_id()
        AND ws_users.is_admin = true
    )
  );

CREATE POLICY "Service role full access on chatbot_reembed_log"
  ON chatbot_reembed_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);
