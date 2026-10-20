-- The nightly achievement snapshot refreshes six ranking materialized views
-- before inserting snapshots and awarding achievements. Its PostgREST call
-- can exceed the inherited 8s statement timeout. Keep the calculation and
-- permissions unchanged; extend the limit only for this RPC.
ALTER FUNCTION public.fn_ach_snapshot_rankings()
  SET statement_timeout TO '30s';
