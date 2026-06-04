-- ============================================================
-- Миграция 063: Рефакторинг расписания заявок на выходной
-- review_scheduled_at/resolve_scheduled_at → _day_off_schedule (ts_a/ts_b)
-- Добавляем approved_by_id/approved_by_name для прозрачности одобрения
-- ============================================================

-- 1. Новые колонки в day_off_requests
ALTER TABLE public.day_off_requests
  ADD COLUMN approved_by_id   uuid NULL REFERENCES public.ws_users(id) ON DELETE SET NULL,
  ADD COLUMN approved_by_name text NULL;

-- 2. Служебная таблица расписания — нейтральные имена, без грантов
CREATE TABLE IF NOT EXISTS public._day_off_schedule (
  request_id uuid PRIMARY KEY REFERENCES public.day_off_requests(id) ON DELETE CASCADE,
  ts_a       timestamptz NOT NULL,
  ts_b       timestamptz NOT NULL
);
-- Явно не даём никаких прав ролям приложения
REVOKE ALL ON public._day_off_schedule FROM authenticated, anon;

-- 3. Переносим данные существующих активных заявок
INSERT INTO public._day_off_schedule (request_id, ts_a, ts_b)
SELECT id, review_scheduled_at, resolve_scheduled_at
FROM public.day_off_requests
WHERE status IN ('pending', 'reviewed')
  AND review_scheduled_at IS NOT NULL
  AND resolve_scheduled_at IS NOT NULL
ON CONFLICT (request_id) DO NOTHING;

-- 4. Удаляем старые колонки
ALTER TABLE public.day_off_requests
  DROP COLUMN IF EXISTS review_scheduled_at,
  DROP COLUMN IF EXISTS resolve_scheduled_at;

-- 5. BEFORE INSERT триггер: только status + user_name (без расписания)
CREATE OR REPLACE FUNCTION public.fn_day_off_requests_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.status := 'pending';
  SELECT (first_name || ' ' || last_name)
    INTO NEW.user_name
    FROM public.ws_users
   WHERE id = NEW.ws_user_id;
  RETURN NEW;
END;
$$;

-- 6. AFTER INSERT триггер: пишем расписание в _day_off_schedule
CREATE OR REPLACE FUNCTION public.fn_day_off_schedule_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public._day_off_schedule (request_id, ts_a, ts_b)
  VALUES (
    NEW.id,
    NOW() + (FLOOR(RANDOM() * 9  + 2)::int || ' minutes')::interval,
    NOW() + (FLOOR(RANDOM() * 56 + 5)::int || ' minutes')::interval
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_day_off_schedule_after_insert
AFTER INSERT ON public.day_off_requests
FOR EACH ROW EXECUTE FUNCTION public.fn_day_off_schedule_after_insert();

REVOKE EXECUTE ON FUNCTION public.fn_day_off_schedule_after_insert() FROM PUBLIC, authenticated, anon;

-- 7. AFTER UPDATE триггер: чистим _day_off_schedule при завершении заявки
CREATE OR REPLACE FUNCTION public.fn_day_off_schedule_cleanup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('approved', 'rejected') THEN
    DELETE FROM public._day_off_schedule WHERE request_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_day_off_schedule_cleanup
AFTER UPDATE OF status ON public.day_off_requests
FOR EACH ROW EXECUTE FUNCTION public.fn_day_off_schedule_cleanup();

REVOKE EXECUTE ON FUNCTION public.fn_day_off_schedule_cleanup() FROM PUBLIC, authenticated, anon;

-- 8. Обновляем pg_cron функцию — JOIN с _day_off_schedule по ts_a/ts_b
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
  -- Шаг 1: pending → reviewed (ts_a)
  UPDATE public.day_off_requests dr
  SET status = 'reviewed', reviewed_at = v_now
  FROM public._day_off_schedule ds
  WHERE ds.request_id = dr.id
    AND dr.status = 'pending'
    AND ds.ts_a <= v_now;

  -- Шаг 2: reviewed → approved (ts_b, только в рабочие часы Пн-Пт 9-18 МСК)
  v_hour_minsk := EXTRACT(HOUR FROM v_now AT TIME ZONE 'Europe/Minsk')::integer;
  v_dow_minsk  := EXTRACT(DOW  FROM v_now AT TIME ZONE 'Europe/Minsk')::integer;

  IF v_dow_minsk NOT BETWEEN 1 AND 5 THEN RETURN; END IF;
  IF v_hour_minsk < 9 OR v_hour_minsk >= 18 THEN RETURN; END IF;

  FOR v_req IN
    SELECT dr.id, dr.ws_user_id, dr.requested_date
    FROM public.day_off_requests dr
    JOIN public._day_off_schedule ds ON ds.request_id = dr.id
    WHERE dr.status = 'reviewed'
      AND ds.ts_b <= v_now
  LOOP
    -- approved_by_id и approved_by_name = NULL означает авто-одобрение
    UPDATE public.day_off_requests
    SET status = 'approved', resolved_at = v_now
    WHERE id = v_req.id;

    INSERT INTO public.ws_user_absences (user_id, user_email, absence_type, absence_date, synced_at)
    SELECT wu.id, wu.email, 'day_off', v_req.requested_date, v_now
    FROM public.ws_users wu
    WHERE wu.id = v_req.ws_user_id
    ON CONFLICT (user_email, absence_date, absence_type) DO NOTHING;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_process_day_off_requests() FROM PUBLIC, authenticated, anon;
