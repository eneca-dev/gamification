-- QA ONLY, after restoring exact production helpers and confirming no overrides remain.
-- Statistical evidence complements (does not replace) review of rejection sampling 0..251.
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
do $check$ begin if to_regclass('roulette_qa.control') is not null then raise exception 'Restore production RNG before sampling'; end if; end $check$;
create temporary table roulette_rng_sample on commit drop as
select roulette_private.roulette_sector() as sector from generate_series(1,70000);
do $test$
declare v_chi numeric;
begin
  if exists(select 1 from roulette_rng_sample where sector is null or sector not between 0 and 6) then
    raise exception 'Invalid random sector';
  end if;
  if (select count(distinct sector) from roulette_rng_sample)<>7 then raise exception 'Missing sector'; end if;
  select sum(power(n-10000,2)/10000) into v_chi
  from(select count(*)::numeric n from roulette_rng_sample group by sector) distribution;
  if v_chi>50 then raise exception 'Uniformity diagnostic failed, chi-square=%; investigate, do not rerun to hide failure',v_chi; end if;
  raise notice '7-sector sample size 70000, chi-square=% (df=6), threshold=50',v_chi;
end $test$;
rollback;
