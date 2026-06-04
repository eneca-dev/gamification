-- ============================================================
-- Миграция 060: Таблица заявок на выходной (геймификация)
-- ============================================================

-- 1. Расширяем CHECK constraint на ws_user_absences
ALTER TABLE public.ws_user_absences
  DROP CONSTRAINT IF EXISTS ws_user_absences_absence_type_check;

ALTER TABLE public.ws_user_absences
  ADD CONSTRAINT ws_user_absences_absence_type_check
  CHECK (absence_type = ANY (ARRAY[
    'vacation'::text,
    'sick_leave'::text,
    'sick_day'::text,
    'day_off'::text
  ]));

-- 2. Создаём таблицу заявок
CREATE TABLE IF NOT EXISTS public.day_off_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ws_user_id            uuid NOT NULL REFERENCES public.ws_users(id) ON DELETE CASCADE,
  user_name             text NOT NULL,
  requested_date        date NOT NULL,
  period                text NOT NULL CHECK (period = ANY (ARRAY['full'::text, 'morning'::text, 'afternoon'::text])),
  note                  text,
  screenshot_url        text,
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'approved'::text, 'rejected'::text])),
  rejection_reason      text,
  reviewed_at           timestamptz,
  resolved_at           timestamptz,
  -- Поля расписания — только сервер, никогда не возвращаются клиенту
  review_scheduled_at   timestamptz NOT NULL,
  resolve_scheduled_at  timestamptz NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_day_off_requests_ws_user_id
  ON public.day_off_requests(ws_user_id);

CREATE INDEX IF NOT EXISTS idx_day_off_requests_status
  ON public.day_off_requests(status);

CREATE INDEX IF NOT EXISTS idx_day_off_requests_resolve_scheduled
  ON public.day_off_requests(resolve_scheduled_at)
  WHERE status IN ('pending', 'reviewed');

-- 3. RLS
ALTER TABLE public.day_off_requests ENABLE ROW LEVEL SECURITY;

-- Сотрудник видит только свои заявки
CREATE POLICY "day_off_requests_select_own"
  ON public.day_off_requests
  FOR SELECT
  TO authenticated
  USING (ws_user_id = ( SELECT my_ws_user_id() ));

-- Сотрудник может создавать заявки только от своего имени
CREATE POLICY "day_off_requests_insert_own"
  ON public.day_off_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (ws_user_id = ( SELECT my_ws_user_id() ));

-- Service role — полный доступ
CREATE POLICY "day_off_requests_service_role"
  ON public.day_off_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Storage bucket для скриншотов
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'day-off-screenshots',
  'day-off-screenshots',
  false,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Политики Storage
CREATE POLICY "day_off_screenshots_upload_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'day-off-screenshots'
    AND (storage.foldername(name))[1] = ( SELECT my_ws_user_id() )::text
  );

CREATE POLICY "day_off_screenshots_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'day-off-screenshots'
    AND (storage.foldername(name))[1] = ( SELECT my_ws_user_id() )::text
  );

CREATE POLICY "day_off_screenshots_service_role"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'day-off-screenshots')
  WITH CHECK (bucket_id = 'day-off-screenshots');

-- 5. Функция авто-обработки (SECURITY DEFINER — только pg_cron)
CREATE OR REPLACE FUNCTION public.fn_process_day_off_requests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now        timestamptz := now();
  v_hour_minsk integer;
  v_dow_minsk  integer;
  v_req        RECORD;
BEGIN
  -- Шаг 1: pending → reviewed (симуляция просмотра)
  UPDATE public.day_off_requests
  SET
    status      = 'reviewed',
    reviewed_at = v_now
  WHERE
    status = 'pending'
    AND review_scheduled_at <= v_now;

  -- Шаг 2: reviewed → approved (только в рабочие часы)
  v_hour_minsk := EXTRACT(HOUR FROM v_now AT TIME ZONE 'Europe/Minsk')::integer;
  v_dow_minsk  := EXTRACT(DOW  FROM v_now AT TIME ZONE 'Europe/Minsk')::integer;

  -- Выходим если вне рабочих часов (9:00–18:00, Пн–Пт)
  IF v_dow_minsk NOT BETWEEN 1 AND 5 THEN RETURN; END IF;
  IF v_hour_minsk < 9 OR v_hour_minsk >= 18 THEN RETURN; END IF;

  FOR v_req IN
    SELECT r.id, r.ws_user_id, r.requested_date
    FROM public.day_off_requests r
    WHERE r.status = 'reviewed'
      AND r.resolve_scheduled_at <= v_now
  LOOP
    -- Апрувим заявку
    UPDATE public.day_off_requests
    SET
      status      = 'approved',
      resolved_at = v_now
    WHERE id = v_req.id;

    -- Вставляем в ws_user_absences чтобы VPS обработал день
    INSERT INTO public.ws_user_absences (
      user_id,
      user_email,
      absence_type,
      absence_date,
      synced_at
    )
    SELECT
      wu.id,
      wu.email,
      'day_off',
      v_req.requested_date,
      v_now
    FROM public.ws_users wu
    WHERE wu.id = v_req.ws_user_id
    ON CONFLICT (user_email, absence_date, absence_type) DO NOTHING;
  END LOOP;
END;
$$;

-- Только service_role и postgres могут вызывать функцию
REVOKE EXECUTE ON FUNCTION public.fn_process_day_off_requests() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_process_day_off_requests() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_process_day_off_requests() FROM anon;

-- 6. pg_cron: запускать каждые 2 минуты
SELECT cron.schedule(
  'process-day-off-requests',
  '*/2 * * * *',
  $$SELECT public.fn_process_day_off_requests()$$
);