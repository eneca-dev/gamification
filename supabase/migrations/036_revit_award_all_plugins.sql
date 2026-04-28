-- Fix fn_award_revit_points: accumulate all plugins used per day in details.plugins array.
-- Previously, ON CONFLICT DO NOTHING caused only the first plugin of the day to be recorded.
-- Now: first plugin creates the log + awards coins; subsequent plugins append to details.plugins.

CREATE OR REPLACE FUNCTION fn_award_revit_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

  -- Subsequent plugin for the same day: append to plugins array and return
  IF v_row_count = 0 THEN
    UPDATE gamification_event_logs
    SET details = jsonb_set(
      details,
      '{plugins}',
      COALESCE(
        details->'plugins',
        -- Handle old records that predate the plugins array
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

  INSERT INTO gamification_transactions (user_id, user_email, event_id, coins)
  VALUES (v_employee_id, lower(NEW.user_email), v_event_id, v_green_pts);

  INSERT INTO gamification_balances (user_id, total_coins, updated_at)
  VALUES (v_employee_id, v_green_pts, now())
  ON CONFLICT (user_id) DO UPDATE
    SET total_coins = gamification_balances.total_coins + v_green_pts,
        updated_at  = now();

  SELECT * INTO v_streak FROM revit_user_streaks WHERE user_id = v_employee_id;

  IF NOT FOUND THEN
    INSERT INTO revit_user_streaks (user_id, current_streak, best_streak, last_green_date, completed_cycles)
    VALUES (v_employee_id, 1, 1, NEW.work_date, 0);
    v_new_streak := 1;

  ELSIF v_streak.is_frozen THEN
    RETURN NEW;

  ELSIF v_streak.pending_reset_date IS NOT NULL THEN
    IF v_streak.pending_reset_expires_at <= now() THEN
      UPDATE revit_user_streaks SET
        current_streak  = 1,
        best_streak     = GREATEST(best_streak, 1),
        last_green_date = NEW.work_date,
        pending_reset_date = NULL,
        pending_reset_expires_at = NULL,
        pending_gap_days = NULL,
        updated_at      = now()
      WHERE user_id = v_employee_id;
      v_new_streak := 1;
    ELSE
      UPDATE revit_user_streaks SET
        last_green_date = NEW.work_date,
        updated_at      = now()
      WHERE user_id = v_employee_id;
      RETURN NEW;
    END IF;

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
      )
      AND NOT EXISTS (
        SELECT 1 FROM calendar_holidays h
        WHERE h.date = d::date
      );

    IF v_gap_days = 0 THEN
      v_new_streak := v_streak.current_streak + 1;
      UPDATE revit_user_streaks SET
        current_streak  = v_new_streak,
        best_streak     = GREATEST(best_streak, v_new_streak),
        last_green_date = NEW.work_date,
        updated_at      = now()
      WHERE user_id = v_employee_id;

    ELSIF v_streak.current_streak > 0 THEN
      UPDATE revit_user_streaks SET
        last_green_date          = NEW.work_date,
        pending_reset_date       = NEW.work_date,
        pending_reset_expires_at = now() + interval '24 hours',
        pending_gap_days         = v_gap_days,
        updated_at               = now()
      WHERE user_id = v_employee_id;
      RETURN NEW;

    ELSE
      v_new_streak := 1;
      UPDATE revit_user_streaks SET
        current_streak  = 1,
        best_streak     = GREATEST(best_streak, 1),
        last_green_date = NEW.work_date,
        updated_at      = now()
      WHERE user_id = v_employee_id;
    END IF;

  ELSE
    v_new_streak := 1;
    UPDATE revit_user_streaks SET
      current_streak  = 1,
      last_green_date = NEW.work_date,
      updated_at      = now()
    WHERE user_id = v_employee_id;
  END IF;

  -- Бонус за 7 дней
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

  -- Бонус за 30 дней + обнуление цикла
  IF v_new_streak = 30 AND v_streak_30 IS NOT NULL THEN
    INSERT INTO gamification_event_logs (user_id, user_email, event_type, source, event_date, details, idempotency_key)
    VALUES (
      v_employee_id, lower(NEW.user_email),
      'revit_streak_30_bonus', 'revit', NEW.work_date,
      jsonb_build_object('completed_cycles', COALESCE(v_streak.completed_cycles, 0) + 1),
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

    -- Обнуление стрика и инкремент completed_cycles
    UPDATE revit_user_streaks SET
      current_streak   = 0,
      completed_cycles = COALESCE(completed_cycles, 0) + 1,
      updated_at       = now()
    WHERE user_id = v_employee_id;
  END IF;

  RETURN NEW;
END;
$$;
