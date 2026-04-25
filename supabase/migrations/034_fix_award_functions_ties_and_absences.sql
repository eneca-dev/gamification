-- Исправление 4 award-функций и view_contest_monthly_winners.
-- Проблема 1: LIMIT 1 при тайсе выбирал победителя произвольно — теперь награждаются все с макс. счётом.
-- Проблема 2: total_employees в award-функциях считал всех активных, игнорируя отсутствующих.
--   Вьюхи же исключают absent_yesterday. Теперь функции используют тех же пользователей
--   что и вьюхи, беря снимок отсутствующих на последний день месяца (= вчера на момент запуска 1-го).
-- Проблема 3: view_contest_monthly_winners через DISTINCT ON возвращал 1 победителя — заменяем на string_agg.

-- ── 1. fn_award_department_contest (Revit отдел) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_award_department_contest()
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  v_today        DATE := fn_minsk_today();
  v_month_start  DATE;
  v_month_end    DATE;
  v_contest_month TEXT;
  v_bonus        INTEGER;
  v_winner       RECORD;
  v_emp          RECORD;
  v_event_id     UUID;
BEGIN
  v_month_start   := date_trunc('month', v_today - interval '1 month')::date;
  v_month_end     := (date_trunc('month', v_today) - interval '1 day')::date;
  v_contest_month := to_char(v_month_start, 'YYYY-MM');

  SELECT coins INTO v_bonus FROM gamification_event_types
  WHERE key = 'team_contest_top1_bonus' AND is_active = true;
  IF v_bonus IS NULL THEN RETURN; END IF;

  FOR v_winner IN
    WITH absent_on_month_end AS (
      SELECT DISTINCT user_id FROM ws_user_absences WHERE absence_date = v_month_end
    ),
    eligible_users AS (
      SELECT wu.id, wu.department_code FROM ws_users wu
      WHERE wu.is_active = true AND wu.department_code IS NOT NULL
        AND wu.team IS DISTINCT FROM 'Декретный'
        AND NOT (wu.id IN (SELECT user_id FROM absent_on_month_end WHERE user_id IS NOT NULL))
    ),
    dept_totals AS (
      SELECT department_code, COUNT(*) AS total_employees FROM eligible_users GROUP BY department_code
    ),
    dept_coins AS (
      SELECT eu.department_code,
        COUNT(DISTINCT t.user_id) AS users_earning,
        SUM(t.coins)              AS total_coins
      FROM gamification_transactions t
      JOIN gamification_event_logs e ON e.id = t.event_id
      JOIN eligible_users eu ON eu.id = t.user_id
      WHERE e.source = 'revit'
        AND e.event_date >= v_month_start AND e.event_date <= v_month_end
      GROUP BY eu.department_code
    ),
    scores AS (
      SELECT dt.department_code,
        ROUND(COALESCE(dc.total_coins, 0)::numeric
          * (COALESCE(dc.users_earning, 0)::numeric / dt.total_employees), 1) AS contest_score
      FROM dept_totals dt LEFT JOIN dept_coins dc ON dc.department_code = dt.department_code
      WHERE COALESCE(dc.total_coins, 0) > 0
    )
    SELECT department_code, contest_score FROM scores
    WHERE contest_score = (SELECT MAX(contest_score) FROM scores)
  LOOP
    FOR v_emp IN
      SELECT id, email FROM ws_users
      WHERE department_code = v_winner.department_code AND is_active = true
    LOOP
      INSERT INTO gamification_event_logs
        (user_id, user_email, event_type, source, event_date, details, idempotency_key)
      VALUES (v_emp.id, v_emp.email, 'team_contest_top1_bonus', 'contest', v_today,
        jsonb_build_object('department', v_winner.department_code,
                           'contest_month', v_contest_month,
                           'contest_score', v_winner.contest_score),
        'dept_top1_revit_' || v_emp.id || '_' || v_contest_month)
      ON CONFLICT (idempotency_key) DO NOTHING RETURNING id INTO v_event_id;
      IF FOUND THEN
        INSERT INTO gamification_transactions (user_id, user_email, event_id, coins)
        VALUES (v_emp.id, v_emp.email, v_event_id, v_bonus);
        INSERT INTO gamification_balances (user_id, total_coins, updated_at)
        VALUES (v_emp.id, v_bonus, now())
        ON CONFLICT (user_id) DO UPDATE
          SET total_coins = gamification_balances.total_coins + v_bonus, updated_at = now();
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;

-- ── 2. fn_award_revit_team_contest (Revit команда) ───────────────────────────
CREATE OR REPLACE FUNCTION public.fn_award_revit_team_contest()
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  v_today        DATE := fn_minsk_today();
  v_month_start  DATE;
  v_month_end    DATE;
  v_contest_month TEXT;
  v_bonus        INTEGER;
  v_winner       RECORD;
  v_emp          RECORD;
  v_event_id     UUID;
BEGIN
  v_month_start   := date_trunc('month', v_today - interval '1 month')::date;
  v_month_end     := (date_trunc('month', v_today) - interval '1 day')::date;
  v_contest_month := to_char(v_month_start, 'YYYY-MM');

  SELECT coins INTO v_bonus FROM gamification_event_types
  WHERE key = 'revit_team_contest_top1_bonus' AND is_active = true;
  IF v_bonus IS NULL THEN RETURN; END IF;

  FOR v_winner IN
    WITH absent_on_month_end AS (
      SELECT DISTINCT user_id FROM ws_user_absences WHERE absence_date = v_month_end
    ),
    eligible_users AS (
      SELECT wu.id, wu.team FROM ws_users wu
      WHERE wu.is_active = true
        AND wu.team IS NOT NULL AND wu.team <> ''
        AND wu.team NOT LIKE 'Вне команд%' AND wu.team <> 'Декретный'
        AND NOT (wu.id IN (SELECT user_id FROM absent_on_month_end WHERE user_id IS NOT NULL))
    ),
    team_totals AS (
      SELECT team, COUNT(*) AS total_employees FROM eligible_users GROUP BY team
    ),
    team_coins AS (
      SELECT eu.team,
        COUNT(DISTINCT t.user_id) AS users_earning,
        SUM(t.coins)              AS total_coins
      FROM gamification_transactions t
      JOIN gamification_event_logs e ON e.id = t.event_id
      JOIN eligible_users eu ON eu.id = t.user_id
      WHERE e.source = 'revit'
        AND e.event_date >= v_month_start AND e.event_date <= v_month_end
      GROUP BY eu.team
    ),
    scores AS (
      SELECT tt.team,
        ROUND(COALESCE(tc.total_coins, 0)::numeric
          * (COALESCE(tc.users_earning, 0)::numeric / tt.total_employees), 1) AS contest_score
      FROM team_totals tt LEFT JOIN team_coins tc ON tc.team = tt.team
      WHERE COALESCE(tc.total_coins, 0) > 0
    )
    SELECT team, contest_score FROM scores
    WHERE contest_score = (SELECT MAX(contest_score) FROM scores)
  LOOP
    FOR v_emp IN
      SELECT id, email FROM ws_users
      WHERE team = v_winner.team AND is_active = true
    LOOP
      INSERT INTO gamification_event_logs
        (user_id, user_email, event_type, source, event_date, details, idempotency_key)
      VALUES (v_emp.id, v_emp.email, 'revit_team_contest_top1_bonus', 'contest', v_today,
        jsonb_build_object('team', v_winner.team,
                           'contest_month', v_contest_month,
                           'contest_score', v_winner.contest_score),
        'team_top1_revit_' || v_emp.id || '_' || v_contest_month)
      ON CONFLICT (idempotency_key) DO NOTHING RETURNING id INTO v_event_id;
      IF FOUND THEN
        INSERT INTO gamification_transactions (user_id, user_email, event_id, coins)
        VALUES (v_emp.id, v_emp.email, v_event_id, v_bonus);
        INSERT INTO gamification_balances (user_id, total_coins, updated_at)
        VALUES (v_emp.id, v_bonus, now())
        ON CONFLICT (user_id) DO UPDATE
          SET total_coins = gamification_balances.total_coins + v_bonus, updated_at = now();
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;

-- ── 3. fn_award_ws_dept_contest (WS отдел) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_award_ws_dept_contest()
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  v_today        DATE := fn_minsk_today();
  v_month_start  DATE;
  v_month_end    DATE;
  v_contest_month TEXT;
  v_bonus        INTEGER;
  v_winner       RECORD;
  v_emp          RECORD;
  v_event_id     UUID;
BEGIN
  v_month_start   := date_trunc('month', v_today - interval '1 month')::date;
  v_month_end     := (date_trunc('month', v_today) - interval '1 day')::date;
  v_contest_month := to_char(v_month_start, 'YYYY-MM');

  SELECT coins INTO v_bonus FROM gamification_event_types
  WHERE key = 'ws_dept_contest_top1_bonus' AND is_active = true;
  IF v_bonus IS NULL THEN RETURN; END IF;

  FOR v_winner IN
    WITH absent_on_month_end AS (
      SELECT DISTINCT user_id FROM ws_user_absences WHERE absence_date = v_month_end
    ),
    eligible_users AS (
      SELECT wu.id, wu.department_code FROM ws_users wu
      WHERE wu.is_active = true AND wu.department_code IS NOT NULL
        AND wu.team IS DISTINCT FROM 'Декретный'
        AND NOT (wu.id IN (SELECT user_id FROM absent_on_month_end WHERE user_id IS NOT NULL))
    ),
    dept_totals AS (
      SELECT department_code, COUNT(*) AS total_employees FROM eligible_users GROUP BY department_code
    ),
    dept_coins AS (
      SELECT eu.department_code, SUM(t.coins) AS total_coins
      FROM gamification_transactions t
      JOIN gamification_event_logs e ON e.id = t.event_id
      JOIN eligible_users eu ON eu.id = t.user_id
      WHERE e.source = 'ws'
        AND e.event_date >= v_month_start AND e.event_date <= v_month_end
      GROUP BY eu.department_code
    ),
    scores AS (
      SELECT dt.department_code,
        ROUND(COALESCE(dc.total_coins, 0)::numeric / dt.total_employees, 1) AS contest_score
      FROM dept_totals dt LEFT JOIN dept_coins dc ON dc.department_code = dt.department_code
      WHERE COALESCE(dc.total_coins, 0) > 0
    )
    SELECT department_code, contest_score FROM scores
    WHERE contest_score = (SELECT MAX(contest_score) FROM scores)
  LOOP
    FOR v_emp IN
      SELECT id, email FROM ws_users
      WHERE department_code = v_winner.department_code AND is_active = true
    LOOP
      INSERT INTO gamification_event_logs
        (user_id, user_email, event_type, source, event_date, details, idempotency_key)
      VALUES (v_emp.id, v_emp.email, 'ws_dept_contest_top1_bonus', 'contest', v_today,
        jsonb_build_object('department', v_winner.department_code,
                           'contest_month', v_contest_month,
                           'contest_score', v_winner.contest_score),
        'dept_top1_ws_' || v_emp.id || '_' || v_contest_month)
      ON CONFLICT (idempotency_key) DO NOTHING RETURNING id INTO v_event_id;
      IF FOUND THEN
        INSERT INTO gamification_transactions (user_id, user_email, event_id, coins)
        VALUES (v_emp.id, v_emp.email, v_event_id, v_bonus);
        INSERT INTO gamification_balances (user_id, total_coins, updated_at)
        VALUES (v_emp.id, v_bonus, now())
        ON CONFLICT (user_id) DO UPDATE
          SET total_coins = gamification_balances.total_coins + v_bonus, updated_at = now();
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;

-- ── 4. fn_award_ws_team_contest (WS команда) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_award_ws_team_contest()
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  v_today        DATE := fn_minsk_today();
  v_month_start  DATE;
  v_month_end    DATE;
  v_contest_month TEXT;
  v_bonus        INTEGER;
  v_winner       RECORD;
  v_emp          RECORD;
  v_event_id     UUID;
BEGIN
  v_month_start   := date_trunc('month', v_today - interval '1 month')::date;
  v_month_end     := (date_trunc('month', v_today) - interval '1 day')::date;
  v_contest_month := to_char(v_month_start, 'YYYY-MM');

  SELECT coins INTO v_bonus FROM gamification_event_types
  WHERE key = 'ws_team_contest_top1_bonus' AND is_active = true;
  IF v_bonus IS NULL THEN RETURN; END IF;

  FOR v_winner IN
    WITH absent_on_month_end AS (
      SELECT DISTINCT user_id FROM ws_user_absences WHERE absence_date = v_month_end
    ),
    eligible_users AS (
      SELECT wu.id, wu.team FROM ws_users wu
      WHERE wu.is_active = true
        AND wu.team IS NOT NULL AND wu.team <> ''
        AND wu.team NOT LIKE 'Вне команд%' AND wu.team <> 'Декретный'
        AND NOT (wu.id IN (SELECT user_id FROM absent_on_month_end WHERE user_id IS NOT NULL))
    ),
    team_totals AS (
      SELECT team, COUNT(*) AS total_employees FROM eligible_users GROUP BY team
    ),
    team_coins AS (
      SELECT eu.team, SUM(t.coins) AS total_coins
      FROM gamification_transactions t
      JOIN gamification_event_logs e ON e.id = t.event_id
      JOIN eligible_users eu ON eu.id = t.user_id
      WHERE e.source = 'ws'
        AND e.event_date >= v_month_start AND e.event_date <= v_month_end
      GROUP BY eu.team
    ),
    scores AS (
      SELECT tt.team,
        ROUND(COALESCE(tc.total_coins, 0)::numeric / tt.total_employees, 1) AS contest_score
      FROM team_totals tt LEFT JOIN team_coins tc ON tc.team = tt.team
      WHERE COALESCE(tc.total_coins, 0) > 0
    )
    SELECT team, contest_score FROM scores
    WHERE contest_score = (SELECT MAX(contest_score) FROM scores)
  LOOP
    FOR v_emp IN
      SELECT id, email FROM ws_users
      WHERE team = v_winner.team AND is_active = true
    LOOP
      INSERT INTO gamification_event_logs
        (user_id, user_email, event_type, source, event_date, details, idempotency_key)
      VALUES (v_emp.id, v_emp.email, 'ws_team_contest_top1_bonus', 'contest', v_today,
        jsonb_build_object('team', v_winner.team,
                           'contest_month', v_contest_month,
                           'contest_score', v_winner.contest_score),
        'team_top1_ws_' || v_emp.id || '_' || v_contest_month)
      ON CONFLICT (idempotency_key) DO NOTHING RETURNING id INTO v_event_id;
      IF FOUND THEN
        INSERT INTO gamification_transactions (user_id, user_email, event_id, coins)
        VALUES (v_emp.id, v_emp.email, v_event_id, v_bonus);
        INSERT INTO gamification_balances (user_id, total_coins, updated_at)
        VALUES (v_emp.id, v_bonus, now())
        ON CONFLICT (user_id) DO UPDATE
          SET total_coins = gamification_balances.total_coins + v_bonus, updated_at = now();
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;

-- ── 5. view_contest_monthly_winners — поддержка нескольких победителей ────────
CREATE OR REPLACE VIEW view_contest_monthly_winners AS
SELECT
  event_type,
  details ->> 'contest_month' AS contest_month,
  string_agg(
    DISTINCT COALESCE(details ->> 'department', details ->> 'team'),
    ', '
    ORDER BY COALESCE(details ->> 'department', details ->> 'team')
  ) AS winner,
  MAX((details ->> 'contest_score')::numeric) AS contest_score,
  MIN(event_date) AS event_date
FROM gamification_event_logs
WHERE event_type = ANY (ARRAY[
  'team_contest_top1_bonus',
  'revit_team_contest_top1_bonus',
  'ws_dept_contest_top1_bonus',
  'ws_team_contest_top1_bonus'
])
GROUP BY event_type, details ->> 'contest_month';
