-- Local WSL fixture only. No production data, external calls, or historical migrations.
-- SELECT definition inspected in the working schema on 2026-11-18; joins are unchanged.
begin;
do $$
begin
  if current_database() <> 'roulette_e2e'
     or (select marker from qa_guard.environment) is distinct from 'isolated-wsl-roulette-qa-v1' then
    raise exception 'Isolated WSL QA marker required';
  end if;
end;
$$;

create or replace view public.view_user_transactions with (security_invoker = true) as
select t.user_id, t.user_email, e.event_date, e.event_type, e.source, t.coins,
  case
    when e.source = 'shop' and e.details ->> 'product_name' is not null then e.details ->> 'product_name'
    else et.description
  end as description,
  e.details, t.created_at, t.id as transaction_id
from public.gamification_transactions t
join public.gamification_event_logs e on e.id = t.event_id
join public.gamification_event_types et on et.key = e.event_type;
revoke all on public.view_user_transactions from public, anon, authenticated;
grant select on public.view_user_transactions to service_role;
-- Empty read fixtures: inspected columns only, no triggers/jobs/write APIs.
-- They support page navigation; they do not certify these modules' business workflows.
create table if not exists public.company_news (
  id uuid primary key default gen_random_uuid(), title text not null,
  body text not null, category text not null, department_code text,
  published_at timestamptz, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), expires_at timestamptz
);
create table if not exists public.alarms (
  id bigint primary key, user_id uuid not null, user_email text not null,
  alarm_type text not null, severity text not null default 'warning',
  title text not null, description text, ws_task_id text, ws_task_name text,
  ws_task_url text, ws_project_id text, details jsonb not null default '{}',
  alarm_date date not null default current_date, is_resolved boolean not null default false,
  resolved_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.ws_user_absences (
  id uuid primary key default gen_random_uuid(), user_id uuid,
  user_email text not null, absence_type text not null, absence_date date not null,
  synced_at timestamptz not null default now(), ws_task_id text
);
alter table public.day_off_requests
  add column if not exists user_name text not null default '',
  add column if not exists requested_date date not null,
  add column if not exists note text,
  add column if not exists screenshot_url text,
  add column if not exists status text not null default 'pending',
  add column if not exists rejection_reason text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists approved_by_id uuid,
  add column if not exists approved_by_name text,
  add column if not exists rejected_by_id uuid,
  add column if not exists rejected_by_name text,
  add column if not exists request_type text not null default 'day_off';
alter table public.company_news enable row level security;
alter table public.alarms enable row level security;
alter table public.ws_user_absences enable row level security;
revoke all on public.company_news, public.alarms, public.ws_user_absences, public.day_off_requests from public, anon, authenticated;
grant select on public.company_news, public.alarms, public.ws_user_absences, public.day_off_requests to service_role;

-- The existing dashboard resolves its own employee through an authenticated client.
-- Do not turn off RLS or allow reading the other synthetic employee.
alter table public.ws_users enable row level security;
grant select on public.ws_users to authenticated;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ws_users' and policyname='qa_dashboard_own_employee') then
    create policy qa_dashboard_own_employee on public.ws_users for select to authenticated
      using (user_id = (select auth.uid()));
  end if;
end;
$$;
notify pgrst, 'reload schema';
commit;
