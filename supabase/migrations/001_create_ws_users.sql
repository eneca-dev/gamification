-- Таблица справочника пользователей Worksection
-- Синхронизируется 2 раза в сутки через Edge Function sync-ws-users

CREATE TABLE IF NOT EXISTS ws_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ws_user_id  text UNIQUE NOT NULL,
  email       text UNIQUE NOT NULL,
  first_name  text NOT NULL,
  last_name   text NOT NULL,
  department  text,
  team        text,
  is_active   boolean NOT NULL DEFAULT true,
  synced_at   timestamptz NOT NULL DEFAULT now()
);

-- Индексы для частых запросов
CREATE INDEX IF NOT EXISTS idx_ws_users_email ON ws_users (email);
CREATE INDEX IF NOT EXISTS idx_ws_users_is_active ON ws_users (is_active) WHERE is_active = true;

-- RLS: таблица используется только серверными Edge Functions
ALTER TABLE ws_users ENABLE ROW LEVEL SECURITY;

-- Разрешаем доступ только через service_role (Edge Functions)
CREATE POLICY "Service role full access" ON ws_users
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
