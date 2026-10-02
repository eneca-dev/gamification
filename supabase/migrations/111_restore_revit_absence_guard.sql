-- Restore the absence guard that was unintentionally lost when the
-- non-working-day guard replaced fn_award_revit_points in migration 073.
-- Revit launches remain in the raw table, but no event, transaction, balance
-- change, or streak start is created for an absent employee.
CREATE OR REPLACE FUNCTION public.fn_award_revit_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_employee_id uuid;
  v_idem_key text;
  v_row_count integer;
  v_green_pts integer;
  v_event_id uuid;
BEGIN
  SELECT coins
  INTO v_green_pts
  FROM public.gamification_event_types
  WHERE key = 'revit_using_plugins'
    AND is_active = true;

  IF v_green_pts IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only a weekday that is not a holiday, or an explicit transferred
  -- workday, can produce a Revit reward.
  IF NOT (
    (
      extract(dow FROM NEW.work_date) NOT IN (0, 6)
      AND NOT EXISTS (
        SELECT 1
        FROM public.calendar_holidays h
        WHERE h.date = NEW.work_date
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.calendar_workdays w
      WHERE w.date = NEW.work_date
    )
  ) THEN
    RETURN NEW;
  END IF;

  SELECT u.id
  INTO v_employee_id
  FROM public.ws_users u
  WHERE lower(u.email) = lower(NEW.user_email)
    AND u.is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Vacation, sick leave, sick day, and gamification day off freeze the
  -- streak and must not grant Revit crystals even if launches were recorded.
  IF EXISTS (
    SELECT 1
    FROM public.ws_user_absences a
    WHERE a.user_id = v_employee_id
      AND a.absence_date = NEW.work_date
  ) THEN
    RETURN NEW;
  END IF;

  v_idem_key := 'revit_green_' || lower(NEW.user_email) || '_' || NEW.work_date::text;

  INSERT INTO public.gamification_event_logs (
    user_id,
    user_email,
    event_type,
    source,
    event_date,
    details,
    idempotency_key
  )
  VALUES (
    v_employee_id,
    lower(NEW.user_email),
    'revit_using_plugins',
    'revit',
    NEW.work_date,
    jsonb_build_object(
      'plugin_name', NEW.plugin_name,
      'launch_count', NEW.launch_count,
      'plugins', jsonb_build_array(
        jsonb_build_object(
          'plugin_name', NEW.plugin_name,
          'launch_count', NEW.launch_count
        )
      )
    ),
    v_idem_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_event_id;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  IF v_row_count = 0 THEN
    UPDATE public.gamification_event_logs
    SET details = jsonb_set(
      details,
      '{plugins}',
      COALESCE(
        details->'plugins',
        jsonb_build_array(
          jsonb_build_object(
            'plugin_name', details->>'plugin_name',
            'launch_count', (details->>'launch_count')::integer
          )
        )
      ) || jsonb_build_array(
        jsonb_build_object(
          'plugin_name', NEW.plugin_name,
          'launch_count', NEW.launch_count
        )
      )
    )
    WHERE idempotency_key = v_idem_key;

    RETURN NEW;
  END IF;

  INSERT INTO public.gamification_transactions (
    user_id,
    user_email,
    event_id,
    coins
  )
  VALUES (
    v_employee_id,
    lower(NEW.user_email),
    v_event_id,
    v_green_pts
  );

  INSERT INTO public.gamification_balances AS b (user_id, total_coins, updated_at)
  VALUES (v_employee_id, v_green_pts, now())
  ON CONFLICT (user_id) DO UPDATE
    SET total_coins = b.total_coins + v_green_pts,
        updated_at = now();

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_award_revit_points() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_award_revit_points() TO service_role;
