-- The replay now invokes the variable bonus reconciler. Keep direct access
-- limited to service_role; correction wrappers run as the database owner.
REVOKE ALL ON FUNCTION public.fn_correction_replay_streak(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_correction_replay_streak(uuid, text)
  TO service_role;
