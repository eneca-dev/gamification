-- VIEW: сумма ревит-баллов по отделам за текущий месяц
CREATE OR REPLACE VIEW view_department_revit_contest AS
WITH dept_coins AS (
  SELECT
    wu.department_code,
    COUNT(DISTINCT t.user_id) AS users_earning,
    SUM(t.coins) AS total_coins
  FROM gamification_transactions t
  JOIN gamification_event_logs e ON e.id = t.event_id
  JOIN ws_users wu ON wu.id = t.user_id AND wu.is_active = true
  WHERE e.source = 'revit'
    AND e.event_date >= date_trunc('month', CURRENT_DATE)
  GROUP BY wu.department_code
),
dept_totals AS (
  SELECT department_code, COUNT(*) AS total_employees
  FROM ws_users
  WHERE is_active = true AND department_code IS NOT NULL
  GROUP BY department_code
)
SELECT
  dt.department_code,
  COALESCE(dc.users_earning, 0) AS users_earning,
  dt.total_employees,
  COALESCE(dc.total_coins, 0) AS total_coins
FROM dept_totals dt
LEFT JOIN dept_coins dc ON dc.department_code = dt.department_code;

-- Функция: начисление бонуса отделу-победителю за прошлый месяц
CREATE OR REPLACE FUNCTION fn_award_department_contest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_contest_month TEXT;
  v_month_start DATE;
  v_month_end DATE;
  v_winner_dept TEXT;
  v_winner_coins BIGINT;
  v_bonus INTEGER;
  v_emp RECORD;
  v_event_id UUID;
BEGIN
  v_month_start := date_trunc('month', CURRENT_DATE - interval '1 month')::date;
  v_month_end := (date_trunc('month', CURRENT_DATE) - interval '1 day')::date;
  v_contest_month := to_char(v_month_start, 'YYYY-MM');

  SELECT coins INTO v_bonus
  FROM gamification_event_types
  WHERE key = 'team_contest_top1_bonus' AND is_active = true;

  IF v_bonus IS NULL THEN
    RETURN;
  END IF;

  SELECT wu.department_code, SUM(t.coins) AS dept_coins
  INTO v_winner_dept, v_winner_coins
  FROM gamification_transactions t
  JOIN gamification_event_logs e ON e.id = t.event_id
  JOIN ws_users wu ON wu.id = t.user_id AND wu.is_active = true
  WHERE e.source = 'revit'
    AND e.event_date >= v_month_start
    AND e.event_date <= v_month_end
    AND wu.department_code IS NOT NULL
  GROUP BY wu.department_code
  ORDER BY dept_coins DESC
  LIMIT 1;

  IF v_winner_dept IS NULL THEN
    RETURN;
  END IF;

  FOR v_emp IN
    SELECT id, email
    FROM ws_users
    WHERE department_code = v_winner_dept AND is_active = true
  LOOP
    INSERT INTO gamification_event_logs (
      user_id, user_email, event_type, source, event_date, details, idempotency_key
    ) VALUES (
      v_emp.id,
      v_emp.email,
      'team_contest_top1_bonus',
      'contest',
      CURRENT_DATE,
      jsonb_build_object(
        'department', v_winner_dept,
        'contest_month', v_contest_month,
        'department_coins', v_winner_coins
      ),
      'dept_top1_revit_' || v_emp.id || '_' || v_contest_month
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_event_id;

    IF FOUND THEN
      INSERT INTO gamification_transactions (user_id, user_email, event_id, coins)
      VALUES (v_emp.id, v_emp.email, v_event_id, v_bonus);

      INSERT INTO gamification_balances (user_id, total_coins, updated_at)
      VALUES (v_emp.id, v_bonus, now())
      ON CONFLICT (user_id) DO UPDATE
        SET total_coins = gamification_balances.total_coins + v_bonus,
            updated_at = now();
    END IF;
  END LOOP;
END;
$function$;

-- Cron: 1 числа каждого месяца в 02:00 UTC
SELECT cron.schedule(
  'award-department-contest',
  '0 2 1 * *',
  $$SELECT fn_award_department_contest()$$
);
