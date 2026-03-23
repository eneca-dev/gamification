-- RLS policy: разрешить чтение ws_user_streaks и gamification_event_types для authenticated
CREATE POLICY "authenticated users can read ws_user_streaks"
  ON ws_user_streaks FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated users can read gamification_event_types"
  ON gamification_event_types FOR SELECT TO authenticated USING (true);
