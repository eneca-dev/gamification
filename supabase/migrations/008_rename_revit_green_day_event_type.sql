-- Переименование event_type: revit_green_day_points → revit_using_plugins
-- Пересоздаём FK с ON UPDATE CASCADE, чтобы будущие переименования делались одним UPDATE.

-- 1. Пересоздать FK с CASCADE UPDATE
ALTER TABLE gamification_event_logs DROP CONSTRAINT gamification_events_event_type_fkey;

ALTER TABLE gamification_event_logs
  ADD CONSTRAINT gamification_events_event_type_fkey
  FOREIGN KEY (event_type) REFERENCES gamification_event_types(key)
  ON UPDATE CASCADE;

-- 2. Переименовать ключ — gamification_event_logs обновится автоматически через CASCADE
UPDATE gamification_event_types
SET key = 'revit_using_plugins'
WHERE key = 'revit_green_day_points';

-- 3. Обновить триггерную функцию
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

  -- Обновление стрика
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

  -- Бонус за стрик 7 дней
  IF v_new_streak = 7 THEN
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

  -- Бонус за стрик 30 дней
  IF v_new_streak = 30 THEN
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
