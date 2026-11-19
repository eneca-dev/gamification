-- REVIEW ONLY: bootstrap marker on the separately approved empty QA project.
-- This is NOT an identity detector: verify the actual connection/dashboard ref first.
-- Replace placeholder only after project selection. No overrides are enabled here.
begin;
do $guard$
declare v_ref text := 'REPLACE_WITH_APPROVED_QA_PROJECT_REF';
begin
  if v_ref !~ '^[a-z]{20}$' or v_ref='yqezhfughtublpaitmij' then
    raise exception 'Concrete non-production QA project ref required';
  end if;
  if not pg_try_advisory_xact_lock(191742090) then
    raise exception 'Another roulette QA suite is active';
  end if;
end $guard$;
create schema qa_guard;
revoke all on schema qa_guard from public,anon,authenticated,service_role;
create table qa_guard.environment (
  singleton boolean primary key default true check(singleton),
  project_ref text not null unique check(project_ref ~ '^[a-z]{20}$' and project_ref<>'yqezhfughtublpaitmij'),
  outbound_reviewed boolean not null default false,
  overrides_approved boolean not null default false
);
alter table qa_guard.environment enable row level security;
revoke all on qa_guard.environment from public,anon,authenticated,service_role;
insert into qa_guard.environment(singleton,project_ref)
values(true,'REPLACE_WITH_APPROVED_QA_PROJECT_REF');
commit;

-- Separate approval step AFTER auditing destinations and the QA mechanism:
-- update qa_guard.environment
-- set outbound_reviewed=true, overrides_approved=true
-- where singleton and project_ref='<exact approved QA ref>';
-- Do not set these flags merely because project creation succeeded.

