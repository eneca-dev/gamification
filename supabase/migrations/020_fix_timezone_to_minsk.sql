-- ============================================================
-- Фикс таймзоны: все CURRENT_DATE → минское время (Europe/Minsk)
-- Supabase работает в UTC, поэтому CURRENT_DATE = UTC дата.
-- Все функции и вью должны считать "сегодня" по Минску.
-- ============================================================

-- Хелпер: текущая дата по Минску
CREATE OR REPLACE FUNCTION public.fn_minsk_today()
  RETURNS date
  LANGUAGE sql
  STABLE
AS $$ SELECT (now() AT TIME ZONE 'Europe/Minsk')::date $$;

-- ============================================================
-- 1. fn_ach_period_start / fn_ach_period_end — дефолт параметра
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_ach_period_start(p_date date DEFAULT NULL)
  RETURNS date
  LANGUAGE sql
  STABLE
AS $$
  SELECT date_trunc('month', COALESCE(p_date, fn_minsk_today()))::date
$$;

CREATE OR REPLACE FUNCTION public.fn_ach_period_end(p_date date DEFAULT NULL)
  RETURNS date
  LANGUAGE sql
  STABLE
AS $$
  SELECT (date_trunc('month', COALESCE(p_date, fn_minsk_today())) + interval '1 month' - interval '1 day')::date
$$;

-- ============================================================
-- 2. fn_ach_snapshot_rankings — CURRENT_DATE → fn_minsk_today()
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_ach_snapshot_rankings()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_today date := fn_minsk_today();
  v_period_start date;
  v_top_personal int := 10;
  v_top_group int := 5;
  v_snap_count int := 0;
  v_awarded_count int := 0;
  v_rec RECORD;
  v_bonus int;
  v_event_id uuid;
  v_emp RECORD;
  v_tmp int;
  v_threshold int;
BEGIN
  v_period_start := fn_ach_period_start(v_today);

  REFRESH MATERIALIZED VIEW CONCURRENTLY view_top_pers_revit;
  REFRESH MATERIALIZED VIEW CONCURRENTLY view_top_pers_ws;
  REFRESH MATERIALIZED VIEW CONCURRENTLY view_top_team_revit;
  REFRESH MATERIALIZED VIEW CONCURRENTLY view_top_team_ws;
  REFRESH MATERIALIZED VIEW CONCURRENTLY view_top_dept_revit;
  REFRESH MATERIALIZED VIEW CONCURRENTLY view_top_dept_ws;

  -- REVIT
  INSERT INTO ach_ranking_snapshots (entity_id, entity_type, area, rank, score, snapshot_date, period_start)
  SELECT user_id::text, 'user', 'revit', rank::smallint, total_coins, v_today, v_period_start
  FROM view_top_pers_revit WHERE rank <= v_top_personal
  ON CONFLICT (entity_id, entity_type, area, snapshot_date) DO NOTHING;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_snap_count := v_snap_count + v_tmp;

  INSERT INTO ach_ranking_snapshots (entity_id, entity_type, area, rank, score, snapshot_date, period_start)
  SELECT team, 'team', 'revit', rank::smallint, contest_score, v_today, v_period_start
  FROM view_top_team_revit WHERE rank <= v_top_group
  ON CONFLICT (entity_id, entity_type, area, snapshot_date) DO NOTHING;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_snap_count := v_snap_count + v_tmp;

  INSERT INTO ach_ranking_snapshots (entity_id, entity_type, area, rank, score, snapshot_date, period_start)
  SELECT department_code, 'department', 'revit', rank::smallint, contest_score, v_today, v_period_start
  FROM view_top_dept_revit WHERE rank <= v_top_group
  ON CONFLICT (entity_id, entity_type, area, snapshot_date) DO NOTHING;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_snap_count := v_snap_count + v_tmp;

  -- WORKSECTION
  INSERT INTO ach_ranking_snapshots (entity_id, entity_type, area, rank, score, snapshot_date, period_start)
  SELECT user_id::text, 'user', 'ws', rank::smallint, total_coins, v_today, v_period_start
  FROM view_top_pers_ws WHERE rank <= v_top_personal
  ON CONFLICT (entity_id, entity_type, area, snapshot_date) DO NOTHING;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_snap_count := v_snap_count + v_tmp;

  INSERT INTO ach_ranking_snapshots (entity_id, entity_type, area, rank, score, snapshot_date, period_start)
  SELECT team, 'team', 'ws', rank::smallint, contest_score, v_today, v_period_start
  FROM view_top_team_ws WHERE rank <= v_top_group
  ON CONFLICT (entity_id, entity_type, area, snapshot_date) DO NOTHING;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_snap_count := v_snap_count + v_tmp;

  INSERT INTO ach_ranking_snapshots (entity_id, entity_type, area, rank, score, snapshot_date, period_start)
  SELECT department_code, 'department', 'ws', rank::smallint, contest_score, v_today, v_period_start
  FROM view_top_dept_ws WHERE rank <= v_top_group
  ON CONFLICT (entity_id, entity_type, area, snapshot_date) DO NOTHING;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_snap_count := v_snap_count + v_tmp;

  -- ПРОВЕРКА ПОРОГОВ И ВЫДАЧА ДОСТИЖЕНИЙ
  FOR v_rec IN
    SELECT s.entity_id, s.entity_type, s.area, COUNT(*) AS days_in_top,
      COALESCE((SELECT threshold FROM ach_ranking_settings rs WHERE rs.area = s.area AND rs.entity_type = s.entity_type AND rs.is_active = true), 10) AS threshold
    FROM ach_ranking_snapshots s
    WHERE s.period_start = v_period_start
      AND s.rank <= CASE s.entity_type WHEN 'user' THEN v_top_personal ELSE v_top_group END
    GROUP BY s.entity_id, s.entity_type, s.area
    HAVING COUNT(*) >= COALESCE((SELECT threshold FROM ach_ranking_settings rs WHERE rs.area = s.area AND rs.entity_type = s.entity_type AND rs.is_active = true), 10)
  LOOP
    IF EXISTS (
      SELECT 1 FROM ach_awards WHERE entity_id = v_rec.entity_id
        AND entity_type = v_rec.entity_type AND area = v_rec.area AND period_start = v_period_start
    ) THEN CONTINUE; END IF;

    SELECT coins INTO v_bonus FROM gamification_event_types
    WHERE key = CASE v_rec.entity_type
      WHEN 'user' THEN 'ach_personal' WHEN 'team' THEN 'ach_team' WHEN 'department' THEN 'ach_department'
    END AND is_active = true;

    IF v_bonus IS NULL THEN CONTINUE; END IF;

    IF v_rec.entity_type = 'user' THEN
      INSERT INTO gamification_event_logs (user_id, user_email, event_type, source, event_date, details, idempotency_key)
      SELECT wu.id, wu.email, 'ach_personal', 'achievements', v_today,
        jsonb_build_object('area', v_rec.area, 'days_in_top', v_rec.days_in_top, 'period_start', v_period_start),
        'ach_user_' || v_rec.area || '_' || v_rec.entity_id || '_' || v_period_start
      FROM ws_users wu WHERE wu.id = v_rec.entity_id::uuid
      ON CONFLICT (idempotency_key) DO NOTHING RETURNING id INTO v_event_id;

      IF v_event_id IS NOT NULL THEN
        INSERT INTO gamification_transactions (user_id, user_email, event_id, coins)
        SELECT wu.id, wu.email, v_event_id, v_bonus FROM ws_users wu WHERE wu.id = v_rec.entity_id::uuid;
        INSERT INTO gamification_balances (user_id, total_coins, updated_at) VALUES (v_rec.entity_id::uuid, v_bonus, now())
        ON CONFLICT (user_id) DO UPDATE SET total_coins = gamification_balances.total_coins + v_bonus, updated_at = now();
        v_awarded_count := v_awarded_count + 1;
      END IF;

    ELSIF v_rec.entity_type = 'team' THEN
      FOR v_emp IN SELECT id, email FROM ws_users WHERE team = v_rec.entity_id AND is_active = true AND team != 'Декретный' LOOP
        INSERT INTO gamification_event_logs (user_id, user_email, event_type, source, event_date, details, idempotency_key)
        VALUES (v_emp.id, v_emp.email, 'ach_team', 'achievements', v_today,
          jsonb_build_object('area', v_rec.area, 'team', v_rec.entity_id, 'days_in_top', v_rec.days_in_top, 'period_start', v_period_start),
          'ach_team_' || v_rec.area || '_' || v_emp.id || '_' || v_period_start)
        ON CONFLICT (idempotency_key) DO NOTHING RETURNING id INTO v_event_id;
        IF FOUND AND v_event_id IS NOT NULL THEN
          INSERT INTO gamification_transactions (user_id, user_email, event_id, coins) VALUES (v_emp.id, v_emp.email, v_event_id, v_bonus);
          INSERT INTO gamification_balances (user_id, total_coins, updated_at) VALUES (v_emp.id, v_bonus, now())
          ON CONFLICT (user_id) DO UPDATE SET total_coins = gamification_balances.total_coins + v_bonus, updated_at = now();
        END IF;
      END LOOP;
      v_awarded_count := v_awarded_count + 1;

    ELSIF v_rec.entity_type = 'department' THEN
      FOR v_emp IN SELECT id, email FROM ws_users WHERE department_code = v_rec.entity_id AND is_active = true AND team IS DISTINCT FROM 'Декретный' LOOP
        INSERT INTO gamification_event_logs (user_id, user_email, event_type, source, event_date, details, idempotency_key)
        VALUES (v_emp.id, v_emp.email, 'ach_department', 'achievements', v_today,
          jsonb_build_object('area', v_rec.area, 'department', v_rec.entity_id, 'days_in_top', v_rec.days_in_top, 'period_start', v_period_start),
          'ach_dept_' || v_rec.area || '_' || v_emp.id || '_' || v_period_start)
        ON CONFLICT (idempotency_key) DO NOTHING RETURNING id INTO v_event_id;
        IF FOUND AND v_event_id IS NOT NULL THEN
          INSERT INTO gamification_transactions (user_id, user_email, event_id, coins) VALUES (v_emp.id, v_emp.email, v_event_id, v_bonus);
          INSERT INTO gamification_balances (user_id, total_coins, updated_at) VALUES (v_emp.id, v_bonus, now())
          ON CONFLICT (user_id) DO UPDATE SET total_coins = gamification_balances.total_coins + v_bonus, updated_at = now();
        END IF;
      END LOOP;
      v_awarded_count := v_awarded_count + 1;
    END IF;

    INSERT INTO ach_awards (entity_id, entity_type, area, period_start, days_in_top)
    VALUES (v_rec.entity_id, v_rec.entity_type, v_rec.area, v_period_start, v_rec.days_in_top)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object('date', v_today, 'period_start', v_period_start,
    'period_end', fn_ach_period_end(v_today), 'snapshots_inserted', v_snap_count, 'awards_given', v_awarded_count);
END;
$function$;

-- ============================================================
-- 3. Materialized views — пересоздание с fn_minsk_today()
-- ============================================================

-- 3a. view_top_pers_revit
DROP MATERIALIZED VIEW IF EXISTS view_top_pers_revit CASCADE;
CREATE MATERIALIZED VIEW view_top_pers_revit AS
WITH user_coins AS (
  SELECT t.user_id, wu.email, wu.first_name, wu.last_name, wu.department_code, wu.team,
    sum(t.coins) AS total_coins
  FROM gamification_transactions t
  JOIN gamification_event_logs e ON e.id = t.event_id
  JOIN ws_users wu ON wu.id = t.user_id AND wu.is_active = true
  WHERE e.source = 'revit'
    AND e.event_date >= date_trunc('month', fn_minsk_today()::timestamp)::date
    AND e.event_date <= fn_minsk_today()
    AND wu.team IS DISTINCT FROM 'Декретный'
  GROUP BY t.user_id, wu.email, wu.first_name, wu.last_name, wu.department_code, wu.team
)
SELECT row_number() OVER (ORDER BY total_coins DESC) AS rank,
  user_id, email, first_name, last_name, department_code, team, total_coins,
  date_trunc('month', fn_minsk_today()::timestamp)::date AS period_start
FROM user_coins WHERE total_coins > 0;

CREATE UNIQUE INDEX idx_top_pers_revit_uid ON view_top_pers_revit (user_id);
CREATE INDEX idx_top_pers_revit_rank ON view_top_pers_revit (rank);

-- 3b. view_top_pers_ws
DROP MATERIALIZED VIEW IF EXISTS view_top_pers_ws CASCADE;
CREATE MATERIALIZED VIEW view_top_pers_ws AS
WITH user_coins AS (
  SELECT t.user_id, wu.email, wu.first_name, wu.last_name, wu.department_code, wu.team,
    sum(t.coins) AS total_coins
  FROM gamification_transactions t
  JOIN gamification_event_logs e ON e.id = t.event_id
  JOIN ws_users wu ON wu.id = t.user_id AND wu.is_active = true
  WHERE e.source = 'ws'
    AND e.event_date >= date_trunc('month', fn_minsk_today()::timestamp)::date
    AND e.event_date <= fn_minsk_today()
    AND wu.team IS DISTINCT FROM 'Декретный'
  GROUP BY t.user_id, wu.email, wu.first_name, wu.last_name, wu.department_code, wu.team
)
SELECT row_number() OVER (ORDER BY total_coins DESC) AS rank,
  user_id, email, first_name, last_name, department_code, team, total_coins,
  date_trunc('month', fn_minsk_today()::timestamp)::date AS period_start
FROM user_coins WHERE total_coins > 0;

CREATE UNIQUE INDEX idx_top_pers_ws_uid ON view_top_pers_ws (user_id);
CREATE INDEX idx_top_pers_ws_rank ON view_top_pers_ws (rank);

-- 3c. view_top_team_revit
DROP MATERIALIZED VIEW IF EXISTS view_top_team_revit CASCADE;
CREATE MATERIALIZED VIEW view_top_team_revit AS
WITH absent_today AS (
  SELECT DISTINCT user_id FROM ws_user_absences WHERE absence_date = fn_minsk_today()
),
eligible_users AS (
  SELECT wu.id, wu.team FROM ws_users wu
  WHERE wu.is_active = true AND wu.team IS NOT NULL AND wu.team <> ''
    AND wu.team NOT LIKE 'Вне команд%' AND wu.team <> 'Декретный'
    AND wu.id NOT IN (SELECT user_id FROM absent_today WHERE user_id IS NOT NULL)
),
team_totals AS (
  SELECT team, count(*) AS total_employees FROM eligible_users GROUP BY team
),
team_coins AS (
  SELECT wu.team, count(DISTINCT t.user_id) AS users_earning, sum(t.coins) AS total_coins
  FROM gamification_transactions t
  JOIN gamification_event_logs e ON e.id = t.event_id
  JOIN ws_users wu ON wu.id = t.user_id
  JOIN eligible_users eu ON eu.id = wu.id
  WHERE e.source = 'revit'
    AND e.event_date >= date_trunc('month', fn_minsk_today()::timestamp)::date
    AND e.event_date <= fn_minsk_today()
  GROUP BY wu.team
)
SELECT row_number() OVER (ORDER BY round(COALESCE(tc.total_coins,0)::numeric * (COALESCE(tc.users_earning,0)::numeric / tt.total_employees::numeric), 1) DESC) AS rank,
  tt.team,
  COALESCE(tc.users_earning, 0::bigint) AS users_earning,
  tt.total_employees,
  COALESCE(tc.total_coins, 0::bigint) AS total_coins,
  round(COALESCE(tc.total_coins,0)::numeric * (COALESCE(tc.users_earning,0)::numeric / tt.total_employees::numeric), 1) AS contest_score,
  date_trunc('month', fn_minsk_today()::timestamp)::date AS period_start
FROM team_totals tt
LEFT JOIN team_coins tc ON tc.team = tt.team
WHERE COALESCE(tc.total_coins, 0::bigint) > 0;

CREATE UNIQUE INDEX idx_top_team_revit_team ON view_top_team_revit (team);
CREATE INDEX idx_top_team_revit_rank ON view_top_team_revit (rank);

-- 3d. view_top_team_ws
DROP MATERIALIZED VIEW IF EXISTS view_top_team_ws CASCADE;
CREATE MATERIALIZED VIEW view_top_team_ws AS
WITH absent_today AS (
  SELECT DISTINCT user_id FROM ws_user_absences WHERE absence_date = fn_minsk_today()
),
eligible_users AS (
  SELECT wu.id, wu.team FROM ws_users wu
  WHERE wu.is_active = true AND wu.team IS NOT NULL AND wu.team <> ''
    AND wu.team NOT LIKE 'Вне команд%' AND wu.team <> 'Декретный'
    AND wu.id NOT IN (SELECT user_id FROM absent_today WHERE user_id IS NOT NULL)
),
team_totals AS (
  SELECT team, count(*) AS total_employees FROM eligible_users GROUP BY team
),
team_coins AS (
  SELECT wu.team, count(DISTINCT t.user_id) AS users_earning, sum(t.coins) AS total_coins
  FROM gamification_transactions t
  JOIN gamification_event_logs e ON e.id = t.event_id
  JOIN ws_users wu ON wu.id = t.user_id
  JOIN eligible_users eu ON eu.id = wu.id
  WHERE e.source = 'ws'
    AND e.event_date >= date_trunc('month', fn_minsk_today()::timestamp)::date
    AND e.event_date <= fn_minsk_today()
  GROUP BY wu.team
)
SELECT row_number() OVER (ORDER BY round(COALESCE(tc.total_coins,0)::numeric / tt.total_employees::numeric, 1) DESC) AS rank,
  tt.team,
  COALESCE(tc.users_earning, 0::bigint) AS users_earning,
  tt.total_employees,
  COALESCE(tc.total_coins, 0::bigint) AS total_coins,
  round(COALESCE(tc.total_coins,0)::numeric / tt.total_employees::numeric, 1) AS contest_score,
  date_trunc('month', fn_minsk_today()::timestamp)::date AS period_start
FROM team_totals tt
LEFT JOIN team_coins tc ON tc.team = tt.team
WHERE COALESCE(tc.total_coins, 0::bigint) > 0;

CREATE UNIQUE INDEX idx_top_team_ws_team ON view_top_team_ws (team);
CREATE INDEX idx_top_team_ws_rank ON view_top_team_ws (rank);

-- 3e. view_top_dept_revit
DROP MATERIALIZED VIEW IF EXISTS view_top_dept_revit CASCADE;
CREATE MATERIALIZED VIEW view_top_dept_revit AS
WITH absent_today AS (
  SELECT DISTINCT user_id FROM ws_user_absences WHERE absence_date = fn_minsk_today()
),
eligible_users AS (
  SELECT wu.id, wu.department_code FROM ws_users wu
  WHERE wu.is_active = true AND wu.department_code IS NOT NULL
    AND wu.team IS DISTINCT FROM 'Декретный'
    AND wu.id NOT IN (SELECT user_id FROM absent_today WHERE user_id IS NOT NULL)
),
dept_totals AS (
  SELECT department_code, count(*) AS total_employees FROM eligible_users GROUP BY department_code
),
dept_coins AS (
  SELECT eu.department_code, count(DISTINCT t.user_id) AS users_earning, sum(t.coins) AS total_coins
  FROM gamification_transactions t
  JOIN gamification_event_logs e ON e.id = t.event_id
  JOIN eligible_users eu ON eu.id = t.user_id
  WHERE e.source = 'revit'
    AND e.event_date >= date_trunc('month', fn_minsk_today()::timestamp)::date
    AND e.event_date <= fn_minsk_today()
  GROUP BY eu.department_code
)
SELECT row_number() OVER (ORDER BY round(COALESCE(dc.total_coins,0)::numeric * (COALESCE(dc.users_earning,0)::numeric / dt.total_employees::numeric), 1) DESC) AS rank,
  dt.department_code,
  COALESCE(dc.users_earning, 0::bigint) AS users_earning,
  dt.total_employees,
  COALESCE(dc.total_coins, 0::bigint) AS total_coins,
  round(COALESCE(dc.total_coins,0)::numeric * (COALESCE(dc.users_earning,0)::numeric / dt.total_employees::numeric), 1) AS contest_score,
  date_trunc('month', fn_minsk_today()::timestamp)::date AS period_start
FROM dept_totals dt
LEFT JOIN dept_coins dc ON dc.department_code = dt.department_code
WHERE COALESCE(dc.total_coins, 0::bigint) > 0;

CREATE UNIQUE INDEX idx_top_dept_revit_dept ON view_top_dept_revit (department_code);
CREATE INDEX idx_top_dept_revit_rank ON view_top_dept_revit (rank);

-- 3f. view_top_dept_ws
DROP MATERIALIZED VIEW IF EXISTS view_top_dept_ws CASCADE;
CREATE MATERIALIZED VIEW view_top_dept_ws AS
WITH absent_today AS (
  SELECT DISTINCT user_id FROM ws_user_absences WHERE absence_date = fn_minsk_today()
),
eligible_users AS (
  SELECT wu.id, wu.department_code FROM ws_users wu
  WHERE wu.is_active = true AND wu.department_code IS NOT NULL
    AND wu.team IS DISTINCT FROM 'Декретный'
    AND wu.id NOT IN (SELECT user_id FROM absent_today WHERE user_id IS NOT NULL)
),
dept_totals AS (
  SELECT department_code, count(*) AS total_employees FROM eligible_users GROUP BY department_code
),
dept_coins AS (
  SELECT eu.department_code, count(DISTINCT t.user_id) AS users_earning, sum(t.coins) AS total_coins
  FROM gamification_transactions t
  JOIN gamification_event_logs e ON e.id = t.event_id
  JOIN eligible_users eu ON eu.id = t.user_id
  WHERE e.source = 'ws'
    AND e.event_date >= date_trunc('month', fn_minsk_today()::timestamp)::date
    AND e.event_date <= fn_minsk_today()
  GROUP BY eu.department_code
)
SELECT row_number() OVER (ORDER BY round(COALESCE(dc.total_coins,0)::numeric / dt.total_employees::numeric, 1) DESC) AS rank,
  dt.department_code,
  COALESCE(dc.users_earning, 0::bigint) AS users_earning,
  dt.total_employees,
  COALESCE(dc.total_coins, 0::bigint) AS total_coins,
  round(COALESCE(dc.total_coins,0)::numeric / dt.total_employees::numeric, 1) AS contest_score,
  date_trunc('month', fn_minsk_today()::timestamp)::date AS period_start
FROM dept_totals dt
LEFT JOIN dept_coins dc ON dc.department_code = dt.department_code
WHERE COALESCE(dc.total_coins, 0::bigint) > 0;

CREATE UNIQUE INDEX idx_top_dept_ws_dept ON view_top_dept_ws (department_code);
CREATE INDEX idx_top_dept_ws_rank ON view_top_dept_ws (rank);

-- ============================================================
-- 4. view_department_revit_contest (обычный VIEW)
-- ============================================================

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
    AND e.event_date >= date_trunc('month', fn_minsk_today()::timestamp)::date
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
  COALESCE(dc.total_coins, 0) AS total_coins,
  round(COALESCE(dc.total_coins, 0)::numeric * (COALESCE(dc.users_earning, 0)::numeric / dt.total_employees::numeric), 1) AS contest_score
FROM dept_totals dt
LEFT JOIN dept_coins dc ON dc.department_code = dt.department_code;

-- ============================================================
-- 5. fn_award_department_contest — CURRENT_DATE → fn_minsk_today()
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_award_department_contest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_today DATE := fn_minsk_today();
  v_contest_month TEXT;
  v_month_start DATE;
  v_month_end DATE;
  v_winner_dept TEXT;
  v_winner_score NUMERIC;
  v_bonus INTEGER;
  v_emp RECORD;
  v_event_id UUID;
BEGIN
  v_month_start := date_trunc('month', v_today - interval '1 month')::date;
  v_month_end := (date_trunc('month', v_today) - interval '1 day')::date;
  v_contest_month := to_char(v_month_start, 'YYYY-MM');

  SELECT coins INTO v_bonus
  FROM gamification_event_types
  WHERE key = 'team_contest_top1_bonus' AND is_active = true;

  IF v_bonus IS NULL THEN
    RETURN;
  END IF;

  WITH dept_coins AS (
    SELECT
      wu.department_code,
      COUNT(DISTINCT t.user_id) AS users_earning,
      SUM(t.coins) AS total_coins
    FROM gamification_transactions t
    JOIN gamification_event_logs e ON e.id = t.event_id
    JOIN ws_users wu ON wu.id = t.user_id AND wu.is_active = true
    WHERE e.source = 'revit'
      AND e.event_date >= v_month_start
      AND e.event_date <= v_month_end
      AND wu.department_code IS NOT NULL
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
    ROUND(COALESCE(dc.total_coins, 0) * (COALESCE(dc.users_earning, 0)::numeric / dt.total_employees), 1)
  INTO v_winner_dept, v_winner_score
  FROM dept_totals dt
  LEFT JOIN dept_coins dc ON dc.department_code = dt.department_code
  ORDER BY 2 DESC
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
      v_today,
      jsonb_build_object(
        'department', v_winner_dept,
        'contest_month', v_contest_month,
        'contest_score', v_winner_score
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

-- ============================================================
-- 6. Триггер: VPS пишет event_date для ws в UTC (-1 день от Минска).
--    Корректируем +1 день при INSERT.
--    ВАЖНО: удалить этот триггер если VPS будет исправлен.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_fix_ws_event_date()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.source = 'ws' THEN
    NEW.event_date := NEW.event_date + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fix_ws_event_date ON gamification_event_logs;

CREATE TRIGGER trg_fix_ws_event_date
  BEFORE INSERT ON gamification_event_logs
  FOR EACH ROW
  EXECUTE FUNCTION fn_fix_ws_event_date();

-- Фикс уже записанных ws-данных (event_date сдвинуты на -1 день)
ALTER TABLE gamification_event_logs DISABLE TRIGGER trg_fix_ws_event_date;
UPDATE gamification_event_logs SET event_date = event_date + 1 WHERE source = 'ws';
ALTER TABLE gamification_event_logs ENABLE TRIGGER trg_fix_ws_event_date;

-- ============================================================
-- 7. pg_cron: sync-plugin-launches — после VPS (21:30 UTC = 00:30 Минск)
-- ============================================================

SELECT cron.unschedule('sync-plugin-launches-daily');

SELECT cron.schedule(
  'sync-plugin-launches-daily',
  '30 21 * * *',
  $$
  select net.http_post(
    url := 'https://yqezhfughtublpaitmij.supabase.co/functions/v1/sync-plugin-launches',
    headers := '{"Authorization": "Bearer secret"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);

-- Конкурс отделов — 1 числа в 22:00 UTC (01:00 Минск, после всех синков)
SELECT cron.schedule(
  'award-department-contest',
  '0 22 1 * *',
  $$SELECT fn_award_department_contest()$$
);
