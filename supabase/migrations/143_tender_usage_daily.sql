-- Tender Adviser / Tender Digest: вместо сырых событий хранятся дневные счётчики
-- (по образцу elk_plugin_launches) и единая таблица соответствий пользователей.
-- Старые таблицы ai_tender_*_events удаляются отдельной миграцией 144 после выкладки VPS-скрипта.

CREATE TABLE IF NOT EXISTS public.tender_email_aliases (
  project text NOT NULL CHECK (project IN ('advisor', 'digest')),
  -- advisor: email из Tender Adviser (нижний регистр); digest: числовой ID пользователя Digest
  alias_key text NOT NULL,
  alias_name text,
  ws_user_id uuid REFERENCES public.ws_users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project, alias_key)
);

CREATE INDEX IF NOT EXISTS tender_email_aliases_ws_user_idx
  ON public.tender_email_aliases (ws_user_id);

CREATE TABLE IF NOT EXISTS public.ai_tender_usage_daily (
  project text NOT NULL CHECK (project IN ('advisor', 'digest')),
  work_date date NOT NULL,
  alias_key text NOT NULL,
  action text NOT NULL,
  event_count integer NOT NULL CHECK (event_count > 0),
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project, work_date, alias_key, action)
);

CREATE INDEX IF NOT EXISTS ai_tender_usage_daily_alias_idx
  ON public.ai_tender_usage_daily (project, alias_key, work_date DESC);

ALTER TABLE public.tender_email_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tender_usage_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tender_email_aliases FROM anon, authenticated;
REVOKE ALL ON public.ai_tender_usage_daily FROM anon, authenticated;
GRANT ALL ON public.tender_email_aliases TO service_role;
GRANT ALL ON public.ai_tender_usage_daily TO service_role;

CREATE OR REPLACE VIEW public.ai_tender_usage_resolved
WITH (security_invoker = true) AS
SELECT
  u.project,
  u.work_date,
  u.alias_key,
  u.action,
  u.event_count,
  u.synced_at,
  a.alias_name,
  a.ws_user_id,
  w.email AS user_email,
  NULLIF(btrim(concat_ws(' ', w.first_name, w.last_name)), '') AS user_name
FROM public.ai_tender_usage_daily u
LEFT JOIN public.tender_email_aliases a ON a.project = u.project AND a.alias_key = u.alias_key
LEFT JOIN public.ws_users w ON w.id = a.ws_user_id;

REVOKE ALL ON public.ai_tender_usage_resolved FROM anon, authenticated;
GRANT SELECT ON public.ai_tender_usage_resolved TO service_role;

-- Перенос соответствий из старых таблиц (служебная учётка Digest пропускается)
INSERT INTO public.tender_email_aliases (project, alias_key, alias_name, ws_user_id)
SELECT 'advisor', lower(e.user_email), max(e.user_name),
       (SELECT w.id FROM public.ws_users w WHERE lower(w.email) = max(lower(e.user_email)) LIMIT 1)
FROM public.ai_tender_advisor_events e
GROUP BY lower(e.user_email)
ON CONFLICT (project, alias_key) DO NOTHING;

INSERT INTO public.tender_email_aliases (project, alias_key, alias_name, ws_user_id)
SELECT 'digest', d.digest_user_id, max(d.user_name),
       (SELECT w.id FROM public.ws_users w WHERE lower(w.email) = max(lower(d.user_email)) LIMIT 1)
FROM public.ai_tender_digest_events d
WHERE d.match_status <> 'service_account'
GROUP BY d.digest_user_id
ON CONFLICT (project, alias_key) DO NOTHING;

-- Почты Tender Adviser (@eneca.by) отличаются от рабочих (@enecagroup.com)
UPDATE public.tender_email_aliases a
SET ws_user_id = w.id
FROM (VALUES
  ('illia.miasayedau@eneca.by', 'ilya.myasoedov@enecagroup.com'),
  ('katsiaryna.humennikava@eneca.by', 'ekaterina.gumennikova@enecagroup.com'),
  ('m.nitsieusky@eneca.by', 'maksim.nitievskiy@enecagroup.com'),
  ('i.kulchitskiy@eneca.by', 'igor.kulchitskiy@enecagroup.com')
) AS m (alias_email, ws_email)
JOIN public.ws_users w ON lower(w.email) = m.ws_email
WHERE a.project = 'advisor' AND a.alias_key = m.alias_email AND a.ws_user_id IS NULL;

INSERT INTO public.ai_tender_usage_daily (project, work_date, alias_key, action, event_count, synced_at)
SELECT 'advisor', work_date, lower(user_email), event_type, count(*), max(synced_at)
FROM public.ai_tender_advisor_events
GROUP BY work_date, lower(user_email), event_type
ON CONFLICT (project, work_date, alias_key, action) DO NOTHING;

INSERT INTO public.ai_tender_usage_daily (project, work_date, alias_key, action, event_count, synced_at)
SELECT 'digest', work_date, digest_user_id, action, count(*), max(synced_at)
FROM public.ai_tender_digest_events
WHERE match_status <> 'service_account'
GROUP BY work_date, digest_user_id, action
ON CONFLICT (project, work_date, alias_key, action) DO NOTHING;
