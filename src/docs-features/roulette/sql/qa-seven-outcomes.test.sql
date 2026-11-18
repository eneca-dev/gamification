-- QA ONLY. Run with psql -v ON_ERROR_STOP=1 only after SQL/QA controls approval.
-- Transactional fixture test: no historical users, no persistent test balances.
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
insert into public.crystal_rates(rate) values(80);
update public.roulette_settings set enabled=true where singleton;
update roulette_qa.control set fixed_time='2026-11-17 12:00:00+03',fault_stage=null;
do $tests$
declare
  v_user uuid; v_request uuid; v_result jsonb; v_repeat jsonb; v_amount integer; v_count integer;
  v_expected integer[]:=array[2000,1500,1200,1100,1050,0,0];
  v_sectors text[]:=array['x2','plus500','plus200','plus100','plus50','zero1','zero2'];
begin
  for i in 0..6 loop
    v_user:=gen_random_uuid(); v_request:=gen_random_uuid();
    insert into public.ws_users(id,ws_user_id,email,first_name,last_name)
      values(v_user,'qa-roulette-'||v_user::text,v_user::text||'@roulette.example.invalid','QA','Roulette');
    insert into public.gamification_balances(user_id,total_coins) values(v_user,1000);
    update roulette_qa.control set fixed_sector=i;
    v_result:=public.spin_roulette(v_user,'2026-11',v_request,1000);
    if (v_result->'result'->>'balanceAfter')::integer IS DISTINCT FROM v_expected[i+1]
      or v_result->'result'->>'sector' IS DISTINCT FROM v_sectors[i+1]
      or (v_result->'result'->>'delta')::integer IS DISTINCT FROM v_expected[i+1]-1000
      or (v_result->>'replayed')::boolean IS DISTINCT FROM false
    then raise exception 'Wrong outcome at sector %: %',i,v_result; end if;
    select total_coins into v_amount from public.gamification_balances where user_id=v_user;
    if v_amount IS DISTINCT FROM v_expected[i+1] then raise exception 'Wrong live balance'; end if;
    select count(*) into v_count from public.gamification_event_logs where user_id=v_user and source='roulette';
    if v_count IS DISTINCT FROM 1 then raise exception 'Event count mismatch'; end if;
    select count(*) into v_count from public.gamification_transactions where user_id=v_user;
    if v_count IS DISTINCT FROM 1 then raise exception 'Ledger count mismatch'; end if;
    select coins into v_amount from public.gamification_transactions where user_id=v_user;
    if v_amount IS DISTINCT FROM v_expected[i+1]-1000 then raise exception 'Ledger delta mismatch'; end if;
    if exists(select 1 from public.gamification_transactions where user_id=v_user
      and byn_amount is distinct from round((v_expected[i+1]-1000)::numeric/80,2)) then
      raise exception 'BYN mismatch';
    end if;

    -- History must not overwrite a later live balance; replay accepts another request UUID.
    update public.gamification_balances set total_coins=total_coins+7 where user_id=v_user;
    update public.roulette_settings set enabled=false where singleton;
    update roulette_qa.control set fixed_time='2026-12-01 00:00:01+03';
    v_repeat:=public.spin_roulette(v_user,'2026-11',gen_random_uuid(),999);
    if v_repeat->'result' is distinct from v_result->'result' or (v_repeat->>'replayed')::boolean IS DISTINCT FROM true then
      raise exception 'Replay identity changed';
    end if;
    select total_coins into v_amount from public.gamification_balances where user_id=v_user;
    if v_amount IS DISTINCT FROM v_expected[i+1]+7 then raise exception 'Replay overwrote current balance'; end if;
    update public.roulette_settings set enabled=true where singleton;
    update roulette_qa.control set fixed_time='2026-11-17 12:00:00+03';
  end loop;
  raise notice 'Seven outcomes, ledger, replay, disable, rollover and historical/current balance assertions passed';
end $tests$;
rollback;
