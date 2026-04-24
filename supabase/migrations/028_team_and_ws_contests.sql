-- ============================================================
-- 3 новых конкурса: Revit-команда, ВС-отдел, ВС-команда
-- Победители получают монеты 1-го числа каждого месяца
-- ============================================================

-- event_types
INSERT INTO gamification_event_types (key, name, coins, is_active, description) VALUES
  ('revit_team_contest_top1_bonus',  'Победа команды (Revit)',       200, true, 'Баллы каждому сотруднику команды-победителя по Revit'),
  ('ws_dept_contest_top1_bonus',     'Победа отдела (Worksection)',   200, true, 'Баллы каждому сотруднику отдела-победителя по WS'),
  ('ws_team_contest_top1_bonus',     'Победа команды (Worksection)', 200, true, 'Баллы каждому сотруднику команды-победителя по WS')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- fn_award_revit_team_contest
-- Победитель: команда с max(total_revit_coins × users_earning / total_employees)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_award_revit_team_contest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_today          DATE := fn_minsk_today();
  v_contest_month  TEXT;
  v_month_start    DATE;
  v_month_end      DATE;
  v_winner_team    TEXT;
  v_winner_score   NUMERIC;
  v_bonus          INTEGER;
  v_emp            RECORD;
  v_event_id       UUID;
BEGIN
  v_month_start   := date_trunc('month', v_today - interval '1 month')::date;
  v_month_end     := (date_trunc('month', v_today) - interval '1 day')::date;
  v_contest_month := to_char(v_month_start, 'YYYY-MM');

  SELECT coins INTO v_bonus
  FROM gamification_event_types
  WHERE key = 'revit_team_contest_top1_bonus' AND is_active = true;
  IF v_bonus IS NULL THEN RETURN; END IF;

  WITH team_coins AS (
    SELECT wu.team,
           COUNT(DISTINCT t.user_id) AS users_earning,
           SUM(t.coins)              AS total_coins
    FROM gamification_transactions t
    JOIN gamification_event_logs e ON e.id = t.event_id
    JOIN ws_users wu ON wu.id = t.user_id AND wu.is_active = true
    WHERE e.source = 'revit'
      AND e.event_date >= v_month_start AND e.event_date <= v_month_end
      AND wu.team IS NOT NULL AND wu.team <> ''
      AND wu.team NOT LIKE 'Вне команд%' AND wu.team <> 'Декретный'
    GROUP BY wu.team
  ),
  team_totals AS (
    SELECT team, COUNT(*) AS total_employees
    FROM ws_users
    WHERE is_active = true
      AND team IS NOT NULL AND team <> ''
      AND team NOT LIKE 'Вне команд%' AND team <> 'Декретный'
    GROUP BY team
  )
  SELECT tt.team,
         ROUND(COALESCE(tc.total_coins, 0) * (COALESCE(tc.users_earning, 0)::numeric / tt.total_employees), 1)
  INTO v_winner_team, v_winner_score
  FROM team_totals tt
  LEFT JOIN team_coins tc ON tc.team = tt.team
  ORDER BY 2 DESC LIMIT 1;

  IF v_winner_team IS NULL THEN RETURN; END IF;

  FOR v_emp IN
    SELECT id, email FROM ws_users
    WHERE team = v_winner_team AND is_active = true
  LOOP
    INSERT INTO gamification_event_logs (user_id, user_email, event_type, source, event_date, details, idempotency_key)
    VALUES (v_emp.id, v_emp.email, 'revit_team_contest_top1_bonus', 'contest', v_today,
      jsonb_build_object('team', v_winner_team, 'contest_month', v_contest_month, 'contest_score', v_winner_score),
      'team_top1_revit_' || v_emp.id || '_' || v_contest_month)
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_event_id;

    IF FOUND THEN
      INSERT INTO gamification_transactions (user_id, user_email, event_id, coins)
      VALUES (v_emp.id, v_emp.email, v_event_id, v_bonus);
      INSERT INTO gamification_balances (user_id, total_coins, updated_at)
      VALUES (v_emp.id, v_bonus, now())
      ON CONFLICT (user_id) DO UPDATE
        SET total_coins = gamification_balances.total_coins + v_bonus, updated_at = now();
    END IF;
  END LOOP;
END;
$function$;

-- ============================================================
-- fn_award_ws_dept_contest
-- Победитель: отдел с max(total_ws_coins / total_employees)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_award_ws_dept_contest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_today          DATE := fn_minsk_today();
  v_contest_month  TEXT;
  v_month_start    DATE;
  v_month_end      DATE;
  v_winner_dept    TEXT;
  v_winner_score   NUMERIC;
  v_bonus          INTEGER;
  v_emp            RECORD;
  v_event_id       UUID;
BEGIN
  v_month_start   := date_trunc('month', v_today - interval '1 month')::date;
  v_month_end     := (date_trunc('month', v_today) - interval '1 day')::date;
  v_contest_month := to_char(v_month_start, 'YYYY-MM');

  SELECT coins INTO v_bonus
  FROM gamification_event_types
  WHERE key = 'ws_dept_contest_top1_bonus' AND is_active = true;
  IF v_bonus IS NULL THEN RETURN; END IF;

  WITH dept_coins AS (
    SELECT wu.department_code,
           SUM(t.coins) AS total_coins
    FROM gamification_transactions t
    JOIN gamification_event_logs e ON e.id = t.event_id
    JOIN ws_users wu ON wu.id = t.user_id AND wu.is_active = true
    WHERE e.source = 'ws'
      AND e.event_date >= v_month_start AND e.event_date <= v_month_end
      AND wu.department_code IS NOT NULL
    GROUP BY wu.department_code
  ),
  dept_totals AS (
    SELECT department_code, COUNT(*) AS total_employees
    FROM ws_users
    WHERE is_active = true AND department_code IS NOT NULL
    GROUP BY department_code
  )
  SELECT dt.department_code,
         ROUND(COALESCE(dc.total_coins, 0)::numeric / dt.total_employees, 1)
  INTO v_winner_dept, v_winner_score
  FROM dept_totals dt
  LEFT JOIN dept_coins dc ON dc.department_code = dt.department_code
  ORDER BY 2 DESC LIMIT 1;

  IF v_winner_dept IS NULL THEN RETURN; END IF;

  FOR v_emp IN
    SELECT id, email FROM ws_users
    WHERE department_code = v_winner_dept AND is_active = true
  LOOP
    INSERT INTO gamification_event_logs (user_id, user_email, event_type, source, event_date, details, idempotency_key)
    VALUES (v_emp.id, v_emp.email, 'ws_dept_contest_top1_bonus', 'contest', v_today,
      jsonb_build_object('department', v_winner_dept, 'contest_month', v_contest_month, 'contest_score', v_winner_score),
      'dept_top1_ws_' || v_emp.id || '_' || v_contest_month)
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_event_id;

    IF FOUND THEN
      INSERT INTO gamification_transactions (user_id, user_email, event_id, coins)
      VALUES (v_emp.id, v_emp.email, v_event_id, v_bonus);
      INSERT INTO gamification_balances (user_id, total_coins, updated_at)
      VALUES (v_emp.id, v_bonus, now())
      ON CONFLICT (user_id) DO UPDATE
        SET total_coins = gamification_balances.total_coins + v_bonus, updated_at = now();
    END IF;
  END LOOP;
END;
$function$;

-- ============================================================
-- fn_award_ws_team_contest
-- Победитель: команда с max(total_ws_coins / total_employees)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_award_ws_team_contest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_today          DATE := fn_minsk_today();
  v_contest_month  TEXT;
  v_month_start    DATE;
  v_month_end      DATE;
  v_winner_team    TEXT;
  v_winner_score   NUMERIC;
  v_bonus          INTEGER;
  v_emp            RECORD;
  v_event_id       UUID;
BEGIN
  v_month_start   := date_trunc('month', v_today - interval '1 month')::date;
  v_month_end     := (date_trunc('month', v_today) - interval '1 day')::date;
  v_contest_month := to_char(v_month_start, 'YYYY-MM');

  SELECT coins INTO v_bonus
  FROM gamification_event_types
  WHERE key = 'ws_team_contest_top1_bonus' AND is_active = true;
  IF v_bonus IS NULL THEN RETURN; END IF;

  WITH team_coins AS (
    SELECT wu.team,
           SUM(t.coins) AS total_coins
    FROM gamification_transactions t
    JOIN gamification_event_logs e ON e.id = t.event_id
    JOIN ws_users wu ON wu.id = t.user_id AND wu.is_active = true
    WHERE e.source = 'ws'
      AND e.event_date >= v_month_start AND e.event_date <= v_month_end
      AND wu.team IS NOT NULL AND wu.team <> ''
      AND wu.team NOT LIKE 'Вне команд%' AND wu.team <> 'Декретный'
    GROUP BY wu.team
  ),
  team_totals AS (
    SELECT team, COUNT(*) AS total_employees
    FROM ws_users
    WHERE is_active = true
      AND team IS NOT NULL AND team <> ''
      AND team NOT LIKE 'Вне команд%' AND team <> 'Декретный'
    GROUP BY team
  )
  SELECT tt.team,
         ROUND(COALESCE(tc.total_coins, 0)::numeric / tt.total_employees, 1)
  INTO v_winner_team, v_winner_score
  FROM team_totals tt
  LEFT JOIN team_coins tc ON tc.team = tt.team
  ORDER BY 2 DESC LIMIT 1;

  IF v_winner_team IS NULL THEN RETURN; END IF;

  FOR v_emp IN
    SELECT id, email FROM ws_users
    WHERE team = v_winner_team AND is_active = true
  LOOP
    INSERT INTO gamification_event_logs (user_id, user_email, event_type, source, event_date, details, idempotency_key)
    VALUES (v_emp.id, v_emp.email, 'ws_team_contest_top1_bonus', 'contest', v_today,
      jsonb_build_object('team', v_winner_team, 'contest_month', v_contest_month, 'contest_score', v_winner_score),
      'team_top1_ws_' || v_emp.id || '_' || v_contest_month)
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_event_id;

    IF FOUND THEN
      INSERT INTO gamification_transactions (user_id, user_email, event_id, coins)
      VALUES (v_emp.id, v_emp.email, v_event_id, v_bonus);
      INSERT INTO gamification_balances (user_id, total_coins, updated_at)
      VALUES (v_emp.id, v_bonus, now())
      ON CONFLICT (user_id) DO UPDATE
        SET total_coins = gamification_balances.total_coins + v_bonus, updated_at = now();
    END IF;
  END LOOP;
END;
$function$;

-- ============================================================
-- cron: 1-го числа, 22:01 / 22:02 / 22:03 UTC (после ревит-отдела в 22:00)
-- ============================================================
SELECT cron.schedule('award-revit-team-contest', '1 22 1 * *',  $$SELECT fn_award_revit_team_contest()$$);
SELECT cron.schedule('award-ws-dept-contest',    '2 22 1 * *',  $$SELECT fn_award_ws_dept_contest()$$);
SELECT cron.schedule('award-ws-team-contest',    '3 22 1 * *',  $$SELECT fn_award_ws_team_contest()$$);
