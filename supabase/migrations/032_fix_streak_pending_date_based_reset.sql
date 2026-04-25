-- Исправление: сброс стриков по дате, а не по времени.
-- Проблема: fn_finalize_expired_revit_pendings использовала expires_at <= now(),
-- из-за чего скрипт мог запуститься на секунды раньше expires_at и не сбросить стрик.
-- Решение: сбрасывать всех у кого pending_reset_date < сегодня (по Минску).
-- Это гарантирует сброс при следующем прогоне независимо от точного времени.

-- 1. Исправить fn_finalize_expired_revit_pendings
CREATE OR REPLACE FUNCTION public.fn_finalize_expired_revit_pendings()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE revit_user_streaks SET
    current_streak = 0,
    pending_reset_date = NULL,
    pending_reset_expires_at = NULL,
    pending_gap_days = NULL,
    updated_at = now()
  WHERE pending_reset_date IS NOT NULL
    AND pending_reset_date < fn_minsk_today();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- 2. Новая функция для WS (аналог Revit, вызывается из VPS-скрипта compute-gamification)
CREATE OR REPLACE FUNCTION public.fn_finalize_expired_ws_pendings()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE ws_user_streaks SET
    current_streak = 0,
    pending_reset_date = NULL,
    pending_reset_expires_at = NULL,
    updated_at = now()
  WHERE pending_reset_date IS NOT NULL
    AND pending_reset_date < fn_minsk_today();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;
