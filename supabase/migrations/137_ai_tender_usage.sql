-- Raw AI tender telemetry. These tables do not award crystals.
CREATE TABLE IF NOT EXISTS public.ai_tender_advisor_events (
  source_index text NOT NULL,
  source_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  work_date date NOT NULL,
  event_type text NOT NULL,
  user_email text NOT NULL,
  user_id text,
  user_name text,
  user_position text,
  environment text,
  domain text,
  path text,
  method text,
  page text,
  init_source text,
  app text,
  source_data jsonb NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_index, source_id)
);

CREATE INDEX IF NOT EXISTS ai_tender_advisor_email_date_idx
  ON public.ai_tender_advisor_events (user_email, work_date DESC);
CREATE INDEX IF NOT EXISTS ai_tender_advisor_date_idx
  ON public.ai_tender_advisor_events (work_date DESC);

CREATE TABLE IF NOT EXISTS public.ai_tender_digest_events (
  source_index text NOT NULL,
  source_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  work_date date NOT NULL,
  action text NOT NULL,
  digest_user_id text NOT NULL,
  user_name text,
  user_email text,
  match_status text NOT NULL CHECK (match_status IN ('matched', 'unmatched', 'ambiguous', 'service_account')),
  service_name text,
  source_data jsonb NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_index, source_id)
);

CREATE INDEX IF NOT EXISTS ai_tender_digest_email_date_idx
  ON public.ai_tender_digest_events (user_email, work_date DESC);
CREATE INDEX IF NOT EXISTS ai_tender_digest_date_idx
  ON public.ai_tender_digest_events (work_date DESC);
CREATE INDEX IF NOT EXISTS ai_tender_digest_unmatched_idx
  ON public.ai_tender_digest_events (digest_user_id, work_date DESC)
  WHERE user_email IS NULL;

ALTER TABLE public.ai_tender_advisor_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tender_digest_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_tender_advisor_events FROM anon, authenticated;
REVOKE ALL ON public.ai_tender_digest_events FROM anon, authenticated;
GRANT ALL ON public.ai_tender_advisor_events TO service_role;
GRANT ALL ON public.ai_tender_digest_events TO service_role;

INSERT INTO public.gamification_event_types (key, name, coins, description, is_dynamic_coins, is_active, create_transaction)
VALUES
  ('ai_tender_advisor_monthly', 'Тендер Эдвизор: использование в месяц', 200,
   'Запуск приложения минимум в два разных дня месяца', false, false, false),
  ('ai_tender_digest_monthly', 'Тендер Дайджест: использование в месяц', 200,
   'Просмотр тендера, решение или создание лида минимум в два разных дня месяца', false, false, false)
ON CONFLICT (key) DO NOTHING;
