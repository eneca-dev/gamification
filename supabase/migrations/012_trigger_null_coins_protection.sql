-- Защита от NULL coins: если тип события выключен или отсутствует,
-- триггер пропускает начисление вместо падения на NOT NULL constraint.

-- fn_award_revit_points: добавлена проверка v_green_pts IS NULL + v_streak_7/30 IS NULL
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
  v_streak_7     INTEGER;
  v_streak_30    INTEGER;
  v_streak       public.revit_user_streaks%ROWTYPE;
  v_new_streak   INTEGER;
  v_gap_days     INTEGER;
  v_event_id     UUID;
BEGIN
  SELECT coins INTO v_green_pts FROM gamification_event_types WHERE key = 'revit_using_plugins'   AND is_active = true;
  SELECT coins INTO v_streak_7   FROM gamification_event_types WHERE key = 'revit_streak_7_bonus'  AND is_active = true;
  SELECT coins INTO v_streak_30  FROM gamification_event_types WHERE key = 'revit_streak_30_bonus' AND is_active = true;

  IF v_green_pts IS NULL THEN
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
    jsonb_build_object('plugin_name', NEW.plugin_name, 'launch_count', NEW.launch_count),
    v_idem_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_event_id;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  IF v_row_count = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO gamification_transactions (user_id, user_email, event_id, coins)
  VALUES (v_employee_id, lower(NEW.user_email), v_event_id, v_green_pts);

  INSERT INTO gamification_balances (user_id, total_coins, updated_at)
  VALUES (v_employee_id, v_green_pts, now())
  ON CONFLICT (user_id) DO UPDATE
    SET total_coins = gamification_balances.total_coins + v_green_pts,
        updated_at  = now();

  SELECT * INTO v_streak FROM revit_user_streaks WHERE user_id = v_employee_id;

  IF NOT FOUND THEN
    INSERT INTO revit_user_streaks (user_id, current_streak, best_streak, last_green_date)
    VALUES (v_employee_id, 1, 1, NEW.work_date);
    v_new_streak := 1;

  ELSIF v_streak.is_frozen THEN
    RETURN NEW;

  ELSIF v_streak.last_green_date = NEW.work_date THEN
    RETURN NEW;

  ELSIF v_streak.last_green_date IS NOT NULL AND v_streak.last_green_date < NEW.work_date THEN
    SELECT COUNT(*) INTO v_gap_days
    FROM generate_series(
      v_streak.last_green_date + 1,
      NEW.work_date - 1,
      '1 day'::interval
    ) d
    WHERE extract(dow FROM d) NOT IN (0, 6)
      AND NOT EXISTS (
        SELECT 1 FROM ws_user_absences a
        WHERE a.user_email = lower(NEW.user_email)
          AND a.absence_date = d::date
      );

    IF v_gap_days = 0 THEN
      v_new_streak := v_streak.current_streak + 1;
    ELSE
      v_new_streak := 1;
    END IF;

    UPDATE revit_user_streaks SET
      current_streak  = v_new_streak,
      best_streak     = GREATEST(best_streak, v_new_streak),
      last_green_date = NEW.work_date,
      updated_at      = now()
    WHERE user_id = v_employee_id;

  ELSE
    v_new_streak := 1;
    UPDATE revit_user_streaks SET
      current_streak  = 1,
      last_green_date = NEW.work_date,
      updated_at      = now()
    WHERE user_id = v_employee_id;
  END IF;

  IF v_new_streak = 7 AND v_streak_7 IS NOT NULL THEN
    INSERT INTO gamification_event_logs (user_id, user_email, event_type, source, event_date, details, idempotency_key)
    VALUES (
      v_employee_id, lower(NEW.user_email),
      'revit_streak_7_bonus', 'revit', NEW.work_date,
      '{}'::jsonb,
      'revit_streak_7_' || lower(NEW.user_email) || '_' || NEW.work_date::TEXT
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_event_id;

    IF FOUND THEN
      INSERT INTO gamification_transactions (user_id, user_email, event_id, coins)
      VALUES (v_employee_id, lower(NEW.user_email), v_event_id, v_streak_7);
      INSERT INTO gamification_balances (user_id, total_coins, updated_at)
      VALUES (v_employee_id, v_streak_7, now())
      ON CONFLICT (user_id) DO UPDATE
        SET total_coins = gamification_balances.total_coins + v_streak_7, updated_at = now();
    END IF;
  END IF;

  IF v_new_streak = 30 AND v_streak_30 IS NOT NULL THEN
    INSERT INTO gamification_event_logs (user_id, user_email, event_type, source, event_date, details, idempotency_key)
    VALUES (
      v_employee_id, lower(NEW.user_email),
      'revit_streak_30_bonus', 'revit', NEW.work_date,
      '{}'::jsonb,
      'revit_streak_30_' || lower(NEW.user_email) || '_' || NEW.work_date::TEXT
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_event_id;

    IF FOUND THEN
      INSERT INTO gamification_transactions (user_id, user_email, event_id, coins)
      VALUES (v_employee_id, lower(NEW.user_email), v_event_id, v_streak_30);
      INSERT INTO gamification_balances (user_id, total_coins, updated_at)
      VALUES (v_employee_id, v_streak_30, now())
      ON CONFLICT (user_id) DO UPDATE
        SET total_coins = gamification_balances.total_coins + v_streak_30, updated_at = now();
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- fn_award_gratitude_points: добавлена проверка v_recipient_pts IS NULL
CREATE OR REPLACE FUNCTION public.fn_award_gratitude_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_sender_id     UUID;
  v_recipient_id  UUID;
  v_recipient_pts INTEGER;
  v_sender_count  INTEGER;
  v_event_id      UUID;
BEGIN
  IF NEW.deleted_in_airtable = true THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.deleted_in_airtable = NEW.deleted_in_airtable
     AND OLD.airtable_status = NEW.airtable_status THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_email IS NULL OR NEW.recipient_email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_sender_id
  FROM ws_users WHERE email = lower(NEW.sender_email) AND is_active = true LIMIT 1;
  IF v_sender_id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_recipient_id
  FROM ws_users WHERE email = lower(NEW.recipient_email) AND is_active = true LIMIT 1;
  IF v_recipient_id IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_sender_count
  FROM gamification_event_logs el
  JOIN at_gratitudes g ON el.details->>'gratitude_id' = g.id
  WHERE lower(g.sender_email) = lower(NEW.sender_email)
    AND g.week_start = NEW.week_start
    AND el.event_type = 'gratitude_recipient_points';

  IF v_sender_count > 0 THEN
    RETURN NEW;
  END IF;

  SELECT coins INTO v_recipient_pts
  FROM gamification_event_types WHERE key = 'gratitude_recipient_points' AND is_active = true;

  IF v_recipient_pts IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO gamification_event_logs (user_id, user_email, event_type, source, event_date, details, idempotency_key)
  VALUES (
    v_recipient_id,
    lower(NEW.recipient_email),
    'gratitude_recipient_points',
    'airtable',
    NEW.airtable_created_at::date,
    jsonb_build_object('gratitude_id', NEW.id, 'sender_email', lower(NEW.sender_email)),
    'gratitude_recipient_' || NEW.id
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_event_id;

  IF FOUND THEN
    INSERT INTO gamification_transactions (user_id, user_email, event_id, coins)
    VALUES (v_recipient_id, lower(NEW.recipient_email), v_event_id, v_recipient_pts);

    INSERT INTO gamification_balances (user_id, total_coins, updated_at)
    VALUES (v_recipient_id, v_recipient_pts, now())
    ON CONFLICT (user_id) DO UPDATE
      SET total_coins = gamification_balances.total_coins + v_recipient_pts,
          updated_at  = now();
  END IF;

  RETURN NEW;
END;
$function$;
