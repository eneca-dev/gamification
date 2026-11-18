-- REVIEW ONLY. Not authorized for the working DB yet.
-- Align SQL01 settings privileges with the tested local contract.
-- Do not alter DEFAULT PRIVILEGES or business data.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
lock table public.roulette_settings in share mode;
do $guard$
begin
  if (select count(*) from public.roulette_settings) <> 1
     or (select enabled from public.roulette_settings where singleton) is distinct from false then
    raise exception 'Expected exactly one disabled roulette settings row';
  end if;
end $guard$;
revoke all on table public.roulette_settings from service_role;
grant select, update on table public.roulette_settings to service_role;
do $verify$
begin
  if not has_table_privilege('service_role','public.roulette_settings','select')
     or not has_table_privilege('service_role','public.roulette_settings','update')
     or has_table_privilege('service_role','public.roulette_settings','insert')
     or has_table_privilege('service_role','public.roulette_settings','delete')
     or has_table_privilege('service_role','public.roulette_settings','truncate')
     or has_table_privilege('service_role','public.roulette_settings','references')
     or has_table_privilege('service_role','public.roulette_settings','trigger')
     or has_table_privilege('service_role','public.roulette_settings','maintain') then
    raise exception 'Settings privileges do not match SELECT/UPDATE contract';
  end if;
end $verify$;
commit;
