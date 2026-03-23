-- RLS policy: разрешить чтение ws_daily_statuses для authenticated пользователей
CREATE POLICY "authenticated users can read ws_daily_statuses"
  ON ws_daily_statuses
  FOR SELECT
  TO authenticated
  USING (true);
