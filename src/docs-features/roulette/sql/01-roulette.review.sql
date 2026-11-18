-- REVIEW ONLY. Applying this package requires separate approval and verified safe QA.
-- No cron, HTTP, historical migration replay, or production test data.
begin;
create schema roulette_private;
revoke all on schema roulette_private from public, anon, authenticated;
grant usage on schema roulette_private to service_role;

create table public.roulette_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false
);
alter table public.roulette_settings enable row level security;
revoke all on public.roulette_settings from public, anon, authenticated;
grant select, update on public.roulette_settings to service_role;
insert into public.roulette_settings values (true, false);
insert into public.gamification_event_types
(key,coins,name,description,is_active,is_dynamic_coins,create_transaction)
values ('roulette_spin',0,'Рулетка','Одна проводка на фактическую разницу',true,true,false);

create function roulette_private.roulette_now() returns timestamptz
language sql volatile security invoker set search_path='' as $$ select clock_timestamp() $$;

create function roulette_private.roulette_sector() returns integer
language plpgsql volatile security invoker set search_path='' as $$
declare v_byte integer;
begin
  loop
    v_byte := get_byte(extensions.gen_random_bytes(1),0);
    -- 252 divisible by 7: reject the four extra values before modulo.
    if v_byte < 252 then return v_byte % 7; end if;
  end loop;
end $$;

create function public.get_roulette_result(p_user_id uuid,p_period text) returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare v_entry public.gamification_event_logs%rowtype; v_delta integer; v_tx_user uuid; v_result jsonb; v_expected bigint;
begin
  if p_user_id is null or p_period is null or p_period !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'roulette_invalid_request';
  end if;
  select * into v_entry from public.gamification_event_logs
  where idempotency_key='roulette_'||p_user_id::text||'_'||p_period;
  if not found then return null; end if;
  v_result := v_entry.details;
  select coins,user_id into v_delta,v_tx_user from public.gamification_transactions where event_id=v_entry.id;
  if not found or v_tx_user is distinct from p_user_id or v_entry.user_id<>p_user_id or v_entry.source<>'roulette'
    or v_entry.event_type<>'roulette_spin' or v_result is null
    or not (v_result ?& array['operationId','period','sector','balanceBefore','balanceAfter','delta','completedAt'])
    or jsonb_typeof(v_result->'balanceBefore') is distinct from 'number'
    or jsonb_typeof(v_result->'balanceAfter') is distinct from 'number'
    or jsonb_typeof(v_result->'delta') is distinct from 'number'
    or (v_result->>'operationId')::uuid is null
    or (v_result->>'period') is distinct from p_period
    or coalesce(v_result->>'sector','') not in ('x2','plus500','plus200','plus100','plus50','zero1','zero2')
    or coalesce((v_result->>'balanceBefore')::bigint,0)<=0
    or coalesce((v_result->>'balanceAfter')::bigint,-1)<0
    or (v_result->>'delta')::bigint is distinct from v_delta::bigint
    or (v_result->>'balanceAfter')::bigint-(v_result->>'balanceBefore')::bigint<>v_delta::bigint
    or (v_result->>'completedAt')::timestamptz is null
  then raise exception 'roulette_corrupt_result'; end if;
  v_expected:=case v_result->>'sector'
    when 'x2' then (v_result->>'balanceBefore')::bigint*2
    when 'plus500' then (v_result->>'balanceBefore')::bigint+500
    when 'plus200' then (v_result->>'balanceBefore')::bigint+200
    when 'plus100' then (v_result->>'balanceBefore')::bigint+100
    when 'plus50' then (v_result->>'balanceBefore')::bigint+50 else 0 end;
  if (v_result->>'balanceBefore')::bigint>2147483647 or v_expected>2147483647
    or (v_result->>'balanceAfter')::bigint<>v_expected
  then raise exception 'roulette_corrupt_result'; end if;
  return v_result;
end $$;

create function public.spin_roulette(p_user_id uuid,p_period text,p_operation_id uuid,p_expected_balance integer)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare
  v_result jsonb; v_balance integer; v_after bigint; v_delta bigint; v_now timestamptz;
  v_enabled boolean; v_email text; v_sector integer; v_sector_name text;
  v_event uuid; v_rate numeric;
begin
  if p_user_id is null or p_operation_id is null or p_expected_balance is null
    or p_period is null or p_period !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
  then raise exception 'roulette_invalid_request'; end if;
  -- Completed replay precedes all eligibility checks, including rollover/disable.
  v_result:=public.get_roulette_result(p_user_id,p_period);
  if v_result is not null then return jsonb_build_object('result',v_result,'replayed',true); end if;
  select b.total_coins into v_balance from public.gamification_balances b
    where b.user_id=p_user_id for update;
  if not found then raise exception 'roulette_no_balance'; end if;
  -- Another request may have committed while this transaction waited for its lock.
  v_result:=public.get_roulette_result(p_user_id,p_period);
  if v_result is not null then return jsonb_build_object('result',v_result,'replayed',true); end if;
  v_now:=roulette_private.roulette_now();
  if v_now is null then raise exception 'roulette_invalid_time'; end if;
  if to_char(v_now at time zone 'Europe/Minsk','YYYY-MM')<>p_period then
    raise exception 'roulette_period_changed';
  end if;
  -- A spin passing this read may finish after disabling; no global exclusive lock.
  select enabled into v_enabled from public.roulette_settings where singleton;
  if v_enabled is not true then raise exception 'roulette_disabled'; end if;
  if v_balance<=0 then raise exception 'roulette_no_balance'; end if;
  if v_balance<>p_expected_balance then raise exception 'roulette_balance_changed'; end if;
  select u.email into v_email from public.ws_users u where u.id=p_user_id;
  if v_email is null then raise exception 'roulette_user_missing'; end if;
  -- Validate ALL outcomes before drawing, so overflow cannot bias retries.
  if greatest(v_balance::bigint*2,v_balance::bigint+500)>2147483647 then
    raise exception 'roulette_numeric_limit';
  end if;
  v_rate:=public.current_crystal_rate();
  if v_rate is null or v_rate<=0 or round(greatest(v_balance::bigint,500)::numeric/v_rate,2)>9999999999.99 then
    raise exception 'roulette_numeric_limit';
  end if;
  v_sector:=roulette_private.roulette_sector();
  if v_sector is null or v_sector not between 0 and 6 then raise exception 'roulette_invalid_sector'; end if;
  v_sector_name:=(array['x2','plus500','plus200','plus100','plus50','zero1','zero2'])[v_sector+1];
  v_after:=case v_sector when 0 then v_balance::bigint*2 when 1 then v_balance::bigint+500
    when 2 then v_balance::bigint+200 when 3 then v_balance::bigint+100
    when 4 then v_balance::bigint+50 else 0 end;
  v_delta:=v_after-v_balance;
  v_result:=jsonb_build_object('operationId',p_operation_id,'period',p_period,'sector',v_sector_name,
    'balanceBefore',v_balance,'balanceAfter',v_after,'delta',v_delta,'completedAt',v_now,'crystalRate',v_rate);
  insert into public.gamification_event_logs
    (user_id,user_email,event_type,source,event_date,ranking_date,created_at,idempotency_key,details)
  values(p_user_id,v_email,'roulette_spin','roulette',(v_now at time zone 'Europe/Minsk')::date,
    (v_now at time zone 'Europe/Minsk')::date,v_now,'roulette_'||p_user_id::text||'_'||p_period,v_result)
  returning id into v_event;
  insert into public.gamification_transactions(user_id,user_email,event_id,coins,created_at,byn_amount)
    values(p_user_id,v_email,v_event,v_delta::integer,v_now,round(v_delta::numeric/v_rate,2));
  update public.gamification_balances set total_coins=v_after::integer,updated_at=v_now where user_id=p_user_id;
  return jsonb_build_object('result',v_result,'replayed',false);
end $$;

create function public.get_roulette_state(p_user_id uuid) returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare v_period text; v_enabled boolean;
begin
  if p_user_id is null then raise exception 'roulette_invalid_request'; end if;
  v_period:=to_char(roulette_private.roulette_now() at time zone 'Europe/Minsk','YYYY-MM');
  select enabled into v_enabled from public.roulette_settings where singleton;
  return jsonb_build_object('period',v_period,'enabled',coalesce(v_enabled,false),
    'result',public.get_roulette_result(p_user_id,v_period));
end $$;

create function public.get_roulette_stats(p_from timestamptz,p_to timestamptz) returns jsonb
language sql stable security invoker set search_path='' as $$
select jsonb_build_object('spins',count(*),'players',count(distinct user_id),
  'bets',coalesce(sum((details->>'balanceBefore')::bigint),0),
  'balancesAfter',coalesce(sum((details->>'balanceAfter')::bigint),0),
  'delta',coalesce(sum((details->>'delta')::bigint),0),
  'zeroShare',coalesce(count(*) filter(where (details->>'balanceAfter')::bigint=0)::numeric/nullif(count(*),0),0)
) from public.gamification_event_logs where source='roulette' and event_type='roulette_spin'
  and (p_from is null or created_at>=p_from) and (p_to is null or created_at<p_to)
$$;
revoke all on function roulette_private.roulette_now(),roulette_private.roulette_sector() from public,anon,authenticated;
grant execute on function roulette_private.roulette_now(),roulette_private.roulette_sector() to service_role;
revoke all on function public.get_roulette_result(uuid,text),public.spin_roulette(uuid,text,uuid,integer),
  public.get_roulette_state(uuid),public.get_roulette_stats(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.get_roulette_result(uuid,text),public.spin_roulette(uuid,text,uuid,integer),
  public.get_roulette_state(uuid),public.get_roulette_stats(timestamptz,timestamptz) to service_role;
commit;
