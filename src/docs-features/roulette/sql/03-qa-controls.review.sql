-- QA ONLY, REVIEW ONLY. Never include in production migrations.
-- Requires separate approval after qa_guard.environment is provisioned on the verified QA project.
-- Replace the project-ref placeholder only after that project is identified and approved.
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

create schema roulette_qa;
revoke all on schema roulette_qa from public,anon,authenticated;
grant usage on schema roulette_qa to service_role;
create table roulette_qa.control(
  singleton boolean primary key check(singleton),
  fixed_time timestamptz not null,
  fixed_sector integer not null check(fixed_sector between 0 and 6)
);
alter table roulette_qa.control enable row level security;
revoke all on roulette_qa.control from public,anon,authenticated,service_role;
grant select on roulette_qa.control to service_role;
insert into roulette_qa.control values(true,'2026-11-17 12:00:00+03',0);

create or replace function roulette_private.roulette_now() returns timestamptz
language sql volatile security invoker set search_path='' as $$
  select fixed_time from roulette_qa.control where singleton
$$;
create or replace function roulette_private.roulette_sector() returns integer
language plpgsql volatile security invoker set search_path='' as $$
declare v_sector integer;
begin
  -- Owner-only session lock allows testing disable AFTER the production switch check.
  perform pg_advisory_xact_lock(191742091);
  select fixed_sector into v_sector from roulette_qa.control where singleton;
  return v_sector;
end $$;
-- Only the database owner/test connection can UPDATE roulette_qa.control.
-- No client/service-role API for choosing a sector or time is granted.

-- QA-only transaction fault injection; targets only isolated fixture users.
alter table roulette_qa.control add column fault_stage text
  check(fault_stage in ('event','transaction','balance'));
create function roulette_qa.fail_fixture_stage() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if (select fault_stage from roulette_qa.control where singleton)=TG_ARGV[0]
    and exists(select 1 from public.ws_users where id=NEW.user_id and ws_user_id like 'qa-roulette-%')
  then raise exception 'qa_injected_%',TG_ARGV[0]; end if;
  return NEW;
end $$;
revoke all on function roulette_qa.fail_fixture_stage() from public,anon,authenticated;
create trigger qa_roulette_event_fault after insert on public.gamification_event_logs
  for each row execute function roulette_qa.fail_fixture_stage('event');
create trigger qa_roulette_transaction_fault after insert on public.gamification_transactions
  for each row execute function roulette_qa.fail_fixture_stage('transaction');
create trigger qa_roulette_balance_fault after update on public.gamification_balances
  for each row execute function roulette_qa.fail_fixture_stage('balance');

commit;
