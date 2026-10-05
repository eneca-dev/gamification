-- Align the Revit contest award formula with the leaderboard formula and
-- grant the missing September 2026 awards to the displayed winners.
--
-- Per the business decision, previously granted awards are intentionally kept.

CREATE OR REPLACE FUNCTION public.fn_award_department_contest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_today         date := public.fn_minsk_today();
  v_month_start   date;
  v_month_end     date;
  v_contest_month text;
  v_bonus         integer;
  v_winner        record;
  v_emp           record;
  v_event_id      uuid;
BEGIN
  v_month_start   := date_trunc('month', v_today - interval '1 month')::date;
  v_month_end     := (date_trunc('month', v_today) - interval '1 day')::date;
  v_contest_month := to_char(v_month_start, 'YYYY-MM');

  SELECT coins
  INTO v_bonus
  FROM public.gamification_event_types
  WHERE key = 'team_contest_top1_bonus'
    AND is_active = true;

  IF v_bonus IS NULL THEN
    RETURN;
  END IF;

  FOR v_winner IN
    WITH absent_on_month_end AS (
      SELECT DISTINCT user_id
      FROM public.ws_user_absences
      WHERE absence_date = v_month_end
    ),
    eligible_users AS (
      SELECT wu.id, wu.department_code
      FROM public.ws_users wu
      WHERE wu.is_active = true
        AND wu.department_code IS NOT NULL
        AND wu.team IS DISTINCT FROM 'Декретный'
        AND NOT (
          wu.id IN (
            SELECT user_id
            FROM absent_on_month_end
            WHERE user_id IS NOT NULL
          )
        )
    ),
    department_totals AS (
      SELECT department_code, count(*) AS total_employees
      FROM eligible_users
      GROUP BY department_code
    ),
    department_coins AS (
      SELECT
        eu.department_code,
        count(DISTINCT t.user_id) AS users_earning,
        sum(t.coins) AS total_coins
      FROM public.gamification_transactions t
      JOIN public.gamification_event_logs e ON e.id = t.event_id
      JOIN eligible_users eu ON eu.id = t.user_id
      WHERE e.source = 'revit'
        AND e.event_date >= v_month_start
        AND e.event_date <= v_month_end
      GROUP BY eu.department_code
    ),
    scores AS (
      SELECT
        dt.department_code,
        round(
          coalesce(dc.total_coins, 0)::numeric
          * (coalesce(dc.users_earning, 0)::numeric / dt.total_employees)
          / dt.total_employees,
          1
        ) AS contest_score
      FROM department_totals dt
      LEFT JOIN department_coins dc ON dc.department_code = dt.department_code
      WHERE coalesce(dc.total_coins, 0) > 0
    )
    SELECT department_code, contest_score
    FROM scores
    WHERE contest_score = (SELECT max(contest_score) FROM scores)
  LOOP
    FOR v_emp IN
      SELECT id, email
      FROM public.ws_users
      WHERE department_code = v_winner.department_code
        AND is_active = true
    LOOP
      v_event_id := NULL;

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
        v_emp.id,
        v_emp.email,
        'team_contest_top1_bonus',
        'contest',
        v_today,
        jsonb_build_object(
          'department', v_winner.department_code,
          'contest_month', v_contest_month,
          'contest_score', v_winner.contest_score
        ),
        'dept_top1_revit_' || v_emp.id || '_' || v_contest_month
      )
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id INTO v_event_id;

      IF v_event_id IS NOT NULL THEN
        INSERT INTO public.gamification_transactions (user_id, user_email, event_id, coins)
        VALUES (v_emp.id, v_emp.email, v_event_id, v_bonus);

        INSERT INTO public.gamification_balances (user_id, total_coins, updated_at)
        VALUES (v_emp.id, v_bonus, now())
        ON CONFLICT (user_id) DO UPDATE
          SET total_coins = public.gamification_balances.total_coins + v_bonus,
              updated_at = now();
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_award_revit_team_contest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_today         date := public.fn_minsk_today();
  v_month_start   date;
  v_month_end     date;
  v_contest_month text;
  v_bonus         integer;
  v_winner        record;
  v_emp           record;
  v_event_id      uuid;
BEGIN
  v_month_start   := date_trunc('month', v_today - interval '1 month')::date;
  v_month_end     := (date_trunc('month', v_today) - interval '1 day')::date;
  v_contest_month := to_char(v_month_start, 'YYYY-MM');

  SELECT coins
  INTO v_bonus
  FROM public.gamification_event_types
  WHERE key = 'revit_team_contest_top1_bonus'
    AND is_active = true;

  IF v_bonus IS NULL THEN
    RETURN;
  END IF;

  FOR v_winner IN
    WITH absent_on_month_end AS (
      SELECT DISTINCT user_id
      FROM public.ws_user_absences
      WHERE absence_date = v_month_end
    ),
    eligible_users AS (
      SELECT wu.id, wu.team
      FROM public.ws_users wu
      WHERE wu.is_active = true
        AND wu.team IS NOT NULL
        AND wu.team <> ''
        AND wu.team <> 'Декретный'
        AND NOT (
          wu.id IN (
            SELECT user_id
            FROM absent_on_month_end
            WHERE user_id IS NOT NULL
          )
        )
    ),
    team_totals AS (
      SELECT team, count(*) AS total_employees
      FROM eligible_users
      GROUP BY team
    ),
    team_coins AS (
      SELECT
        eu.team,
        count(DISTINCT t.user_id) AS users_earning,
        sum(t.coins) AS total_coins
      FROM public.gamification_transactions t
      JOIN public.gamification_event_logs e ON e.id = t.event_id
      JOIN eligible_users eu ON eu.id = t.user_id
      WHERE e.source = 'revit'
        AND e.event_date >= v_month_start
        AND e.event_date <= v_month_end
      GROUP BY eu.team
    ),
    scores AS (
      SELECT
        tt.team,
        round(
          coalesce(tc.total_coins, 0)::numeric
          * (coalesce(tc.users_earning, 0)::numeric / tt.total_employees)
          / tt.total_employees,
          1
        ) AS contest_score
      FROM team_totals tt
      LEFT JOIN team_coins tc ON tc.team = tt.team
      WHERE coalesce(tc.total_coins, 0) > 0
    )
    SELECT team, contest_score
    FROM scores
    WHERE contest_score = (SELECT max(contest_score) FROM scores)
  LOOP
    FOR v_emp IN
      SELECT id, email
      FROM public.ws_users
      WHERE team = v_winner.team
        AND is_active = true
    LOOP
      v_event_id := NULL;

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
        v_emp.id,
        v_emp.email,
        'revit_team_contest_top1_bonus',
        'contest',
        v_today,
        jsonb_build_object(
          'team', v_winner.team,
          'contest_month', v_contest_month,
          'contest_score', v_winner.contest_score
        ),
        'team_top1_revit_' || v_emp.id || '_' || v_contest_month
      )
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id INTO v_event_id;

      IF v_event_id IS NOT NULL THEN
        INSERT INTO public.gamification_transactions (user_id, user_email, event_id, coins)
        VALUES (v_emp.id, v_emp.email, v_event_id, v_bonus);

        INSERT INTO public.gamification_balances (user_id, total_coins, updated_at)
        VALUES (v_emp.id, v_bonus, now())
        ON CONFLICT (user_id) DO UPDATE
          SET total_coins = public.gamification_balances.total_coins + v_bonus,
              updated_at = now();
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_award_department_contest() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_award_department_contest() TO service_role;

REVOKE ALL ON FUNCTION public.fn_award_revit_team_contest() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_award_revit_team_contest() TO service_role;

-- September 2026 data correction. Existing awards are deliberately preserved.
DO $correction$
DECLARE
  v_employee record;
  v_event_id uuid;
  v_department_bonus integer;
  v_team_bonus integer;
BEGIN
  SELECT coins
  INTO v_department_bonus
  FROM public.gamification_event_types
  WHERE key = 'team_contest_top1_bonus'
    AND is_active = true;

  SELECT coins
  INTO v_team_bonus
  FROM public.gamification_event_types
  WHERE key = 'revit_team_contest_top1_bonus'
    AND is_active = true;

  IF v_department_bonus IS NULL OR v_team_bonus IS NULL THEN
    RAISE EXCEPTION 'Active Revit contest bonus event types are required';
  END IF;

  FOR v_employee IN
    SELECT id, email
    FROM public.ws_users
    WHERE department_code = 'ЭС гражд'
      AND is_active = true
  LOOP
    v_event_id := NULL;

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
      v_employee.id,
      v_employee.email,
      'team_contest_top1_bonus',
      'contest',
      date '2026-10-01',
      jsonb_build_object(
        'department', 'ЭС гражд',
        'contest_month', '2026-09',
        'contest_score', 190.4,
        'correction', true,
        'correction_reason', 'revit_contest_formula_alignment'
      ),
      'dept_top1_revit_' || v_employee.id || '_2026-09'
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_event_id;

    IF v_event_id IS NOT NULL THEN
      INSERT INTO public.gamification_transactions (user_id, user_email, event_id, coins)
      VALUES (v_employee.id, v_employee.email, v_event_id, v_department_bonus);

      INSERT INTO public.gamification_balances (user_id, total_coins, updated_at)
      VALUES (v_employee.id, v_department_bonus, now())
      ON CONFLICT (user_id) DO UPDATE
        SET total_coins = public.gamification_balances.total_coins + v_department_bonus,
            updated_at = now();
    END IF;
  END LOOP;

  FOR v_employee IN
    SELECT id, email
    FROM public.ws_users
    WHERE team = 'Команда ВК-4'
      AND is_active = true
  LOOP
    v_event_id := NULL;

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
      v_employee.id,
      v_employee.email,
      'revit_team_contest_top1_bonus',
      'contest',
      date '2026-10-01',
      jsonb_build_object(
        'team', 'Команда ВК-4',
        'contest_month', '2026-09',
        'contest_score', 261.7,
        'correction', true,
        'correction_reason', 'revit_contest_formula_alignment'
      ),
      'team_top1_revit_' || v_employee.id || '_2026-09'
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_event_id;

    IF v_event_id IS NOT NULL THEN
      INSERT INTO public.gamification_transactions (user_id, user_email, event_id, coins)
      VALUES (v_employee.id, v_employee.email, v_event_id, v_team_bonus);

      INSERT INTO public.gamification_balances (user_id, total_coins, updated_at)
      VALUES (v_employee.id, v_team_bonus, now())
      ON CONFLICT (user_id) DO UPDATE
        SET total_coins = public.gamification_balances.total_coins + v_team_bonus,
            updated_at = now();
    END IF;
  END LOOP;
END;
$correction$;
