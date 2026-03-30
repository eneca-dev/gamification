-- Таблица предупреждений (алармов)
-- Генерируется VPS-скриптом ежедневно, отображается на дашборде
-- user_id содержит ws_users.id (не auth.users.id)
CREATE TABLE alarms (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL,
  user_email text NOT NULL,
  alarm_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  title text NOT NULL,
  description text,
  ws_task_id text,
  ws_task_name text,
  ws_task_url text,
  ws_project_id text,
  details jsonb NOT NULL DEFAULT '{}',
  alarm_date date NOT NULL DEFAULT CURRENT_DATE,
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT alarms_type_check CHECK (alarm_type IN (
    'label_change_soon',
    'team_label_change_soon'
  )),
  CONSTRAINT alarms_severity_check CHECK (severity IN ('info', 'warning', 'critical'))
);

CREATE INDEX idx_alarms_user_date ON alarms (user_id, alarm_date);
CREATE INDEX idx_alarms_date ON alarms (alarm_date);
CREATE INDEX idx_alarms_unresolved ON alarms (user_id, alarm_date) WHERE is_resolved = false;

-- RLS: user_id = ws_users.id, маппинг через profiles.email → ws_users.email
ALTER TABLE alarms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alarms"
  ON alarms FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT wu.id FROM ws_users wu
      JOIN profiles p ON lower(p.email) = lower(wu.email)
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can resolve own alarms"
  ON alarms FOR UPDATE
  TO authenticated
  USING (
    user_id IN (
      SELECT wu.id FROM ws_users wu
      JOIN profiles p ON lower(p.email) = lower(wu.email)
      WHERE p.user_id = auth.uid()
    )
  );
