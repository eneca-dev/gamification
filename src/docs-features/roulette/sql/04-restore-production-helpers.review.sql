-- QA ONLY, REVIEW ONLY. Restore exact production algorithms before RNG distribution tests.
-- Apply only on the approved isolated QA project, after fixture tests.
begin;
do $guard$
begin
  if to_regclass('qa_guard.environment') is null then
    raise exception 'QA environment has not been verified';
  end if;
  if not exists(select 1 from qa_guard.environment
    where project_ref='REPLACE_WITH_APPROVED_QA_PROJECT_REF'
      and project_ref<>'yqezhfughtublpaitmij' and outbound_reviewed and overrides_approved)
  then raise exception 'Exact QA identity/destinations/override approval missing'; end if;
  if not pg_try_advisory_xact_lock(191742090) then
    raise exception 'Another roulette QA suite is active; stop it before applying this artifact';
  end if;
end $guard$;
create or replace function roulette_private.roulette_now() returns timestamptz
language sql volatile security invoker set search_path='' as $$ select clock_timestamp() $$;
create or replace function roulette_private.roulette_sector() returns integer
language plpgsql volatile security invoker set search_path='' as $$
declare v_byte integer;
begin
  loop
    v_byte:=get_byte(extensions.gen_random_bytes(1),0);
    if v_byte<252 then return v_byte%7; end if;
  end loop;
end $$;
-- Remove QA control surface only after active tests have stopped.
drop trigger qa_roulette_event_fault on public.gamification_event_logs;
drop trigger qa_roulette_transaction_fault on public.gamification_transactions;
drop trigger qa_roulette_balance_fault on public.gamification_balances;
drop function roulette_qa.fail_fixture_stage();
drop table roulette_qa.control;
drop schema roulette_qa;
commit;
