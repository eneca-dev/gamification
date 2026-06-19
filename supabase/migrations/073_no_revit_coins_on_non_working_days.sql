-- Запрет начисления монет за запуски Revit в нерабочие дни.
-- Рабочая логика зеркалит VPS: isWorkingDay = (!isWeekend && !holiday) || workday.
-- calendar_workdays (рабочая суббота/воскресенье) → начислять.
-- Обычные Сб/Вс и calendar_holidays → не начислять.
-- Запись в elk_plugin_launches при этом проходит в любом случае.

CREATE OR REPLACE FUNCTION public.fn_award_revit_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_employee_id  UUID;
  v_idem_key     TEXT;
  v_row_count    INTEGER;
  v_green_pts    INTEGER;
  v_event_id     UUID;
BEGIN
  SELECT coins INTO v_green_pts
  FROM gamification_event_types
  WHERE key = 'revit_using_plugins' AND is_active = true;

  IF v_green_pts IS NULL THEN
    RETURN NEW;
  END IF;

  -- Нерабочий день: выходной (не перенесённый) или праздник → монеты не начислять.
  IF NOT (
    (extract(dow FROM NEW.work_date) NOT IN (0, 6)
     AND NOT EXISTS (SELECT 1 FROM calendar_holidays WHERE date = NEW.work_date))
    OR EXISTS (SELECT 1 FROM calendar_workdays WHERE date = NEW.work_date)
  ) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_employee_id
  FROM ws_users
  WHERE email = lower(NEW.user_email) AND is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_idem_key := 'revit_green_' || lower(NEW.user_email) || '_' || NEW.work_date::TEXT;

  INSERT INTO gamification_event_logs (user_id, user_email, event_type, source, event_date, details, idempotency_key)
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
        jsonb_build_object('plugin_name', NEW.plugin_name, 'launch_count', NEW.launch_count)
      )
    ),
    v_idem_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_event_id;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  -- Повторный плагин в тот же день: дописываем в details.plugins, монеты не начисляем.
  IF v_row_count = 0 THEN
    UPDATE gamification_event_logs
    SET details = jsonb_set(
      details,
      '{plugins}',
      COALESCE(
        details->'plugins',
        jsonb_build_array(jsonb_build_object(
          'plugin_name', details->>'plugin_name',
          'launch_count', (details->>'launch_count')::int
        ))
      ) || jsonb_build_array(jsonb_build_object(
        'plugin_name', NEW.plugin_name,
        'launch_count', NEW.launch_count
      ))
    )
    WHERE idempotency_key = v_idem_key;
    RETURN NEW;
  END IF;

  -- Первый плагин дня: транзакция + баланс.
  INSERT INTO gamification_transactions (user_id, user_email, event_id, coins)
  VALUES (v_employee_id, lower(NEW.user_email), v_event_id, v_green_pts);

  INSERT INTO gamification_balances (user_id, total_coins, updated_at)
  VALUES (v_employee_id, v_green_pts, now())
  ON CONFLICT (user_id) DO UPDATE
    SET total_coins = gamification_balances.total_coins + v_green_pts,
        updated_at  = now();

  RETURN NEW;
END;
$function$;
