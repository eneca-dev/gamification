-- Separate the user-facing award date from the date used to attribute points
-- to a Worksection leaderboard month.
--
-- event_date keeps its existing behaviour: the legacy trigger shifts every WS
-- event by one day to compensate for the UTC date sent by the VPS.
-- ranking_date is the business date used by monthly WS leaderboards:
--   * daily discipline/streak events belong to the work day sent by the VPS;
--   * delayed task rewards and clawbacks belong to the Minsk award day.

ALTER TABLE public.gamification_event_logs
  ADD COLUMN IF NOT EXISTS ranking_date date;

UPDATE public.gamification_event_logs
SET ranking_date = CASE
  WHEN source = 'ws'
   AND event_type IN (
     'green_day',
     'red_day',
     'task_dynamics_violation',
     'section_red',
     'wrong_status_report',
     'streak_reset_timetracking',
     'streak_reset_dynamics',
     'streak_reset_section',
     'streak_reset_wrong_status',
     'ws_streak_7',
     'ws_streak_30',
     'ws_streak_90'
   )
    THEN event_date - 1
  WHEN source = 'ws'
    THEN (created_at AT TIME ZONE 'Europe/Minsk')::date
  ELSE event_date
END
WHERE ranking_date IS NULL;

ALTER TABLE public.gamification_event_logs
  ALTER COLUMN ranking_date SET NOT NULL;

COMMENT ON COLUMN public.gamification_event_logs.ranking_date IS
  'Calendar date used to attribute an event to a leaderboard/reporting period. event_date remains the user-facing award date.';

CREATE INDEX IF NOT EXISTS idx_event_logs_source_ranking_date
  ON public.gamification_event_logs (source, ranking_date);

-- Keep the legacy event_date shift for compatibility with transaction history,
-- but set ranking_date before the shift for work-day events.
CREATE OR REPLACE FUNCTION public.fn_fix_ws_event_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF NEW.source = 'ws' THEN
    NEW.ranking_date := CASE
      WHEN NEW.event_type IN (
        'green_day',
        'red_day',
        'task_dynamics_violation',
        'section_red',
        'wrong_status_report',
        'streak_reset_timetracking',
        'streak_reset_dynamics',
        'streak_reset_section',
        'streak_reset_wrong_status',
        'ws_streak_7',
        'ws_streak_30',
        'ws_streak_90'
      ) THEN NEW.event_date
      ELSE (COALESCE(NEW.created_at, now()) AT TIME ZONE 'Europe/Minsk')::date
    END;
    NEW.event_date := NEW.event_date + 1;
  ELSE
    NEW.ranking_date := NEW.event_date;
  END IF;

  RETURN NEW;
END;
$function$;

-- Personal WS leaderboard.
DROP MATERIALIZED VIEW IF EXISTS public.view_top_pers_ws;
CREATE MATERIALIZED VIEW public.view_top_pers_ws AS
WITH user_coins AS (
  SELECT
    t.user_id,
    wu.email,
    wu.first_name,
    wu.last_name,
    wu.department_code,
    wu.team,
    sum(t.coins) AS total_coins
  FROM public.gamification_transactions t
  JOIN public.gamification_event_logs e ON e.id = t.event_id
  JOIN public.ws_users wu ON wu.id = t.user_id AND wu.is_active = true
  WHERE e.source = 'ws'
    AND e.ranking_date >= date_trunc('month', public.fn_minsk_today()::timestamp without time zone)::date
    AND e.ranking_date <= public.fn_minsk_today()
    AND wu.team IS DISTINCT FROM 'Декретный'
  GROUP BY t.user_id, wu.email, wu.first_name, wu.last_name, wu.department_code, wu.team
)
SELECT
  dense_rank() OVER (ORDER BY total_coins DESC) AS rank,
  user_id,
  email,
  first_name,
  last_name,
  department_code,
  team,
  total_coins,
  date_trunc('month', public.fn_minsk_today()::timestamp without time zone)::date AS period_start
FROM user_coins
WHERE total_coins > 0
WITH NO DATA;

CREATE UNIQUE INDEX view_top_pers_ws_user_id_idx
  ON public.view_top_pers_ws (user_id);

-- Department WS leaderboard.
DROP MATERIALIZED VIEW IF EXISTS public.view_top_dept_ws;
CREATE MATERIALIZED VIEW public.view_top_dept_ws AS
WITH absent_yesterday AS (
  SELECT DISTINCT a.user_id
  FROM public.ws_user_absences a
  WHERE a.absence_date = public.fn_minsk_today() - 1
),
eligible_users AS (
  SELECT wu.id, wu.department_code
  FROM public.ws_users wu
  WHERE wu.is_active = true
    AND wu.department_code IS NOT NULL
    AND wu.team IS DISTINCT FROM 'Декретный'
    AND NOT (
      wu.id IN (
        SELECT ay.user_id
        FROM absent_yesterday ay
        WHERE ay.user_id IS NOT NULL
      )
    )
),
dept_totals AS (
  SELECT eu.department_code, count(*) AS total_employees
  FROM eligible_users eu
  GROUP BY eu.department_code
),
dept_coins AS (
  SELECT
    eu.department_code,
    count(DISTINCT t.user_id) AS users_earning,
    sum(t.coins) AS total_coins
  FROM public.gamification_transactions t
  JOIN public.gamification_event_logs e ON e.id = t.event_id
  JOIN eligible_users eu ON eu.id = t.user_id
  WHERE e.source = 'ws'
    AND e.ranking_date >= date_trunc('month', public.fn_minsk_today()::timestamp without time zone)::date
    AND e.ranking_date <= public.fn_minsk_today()
  GROUP BY eu.department_code
)
SELECT
  row_number() OVER (
    ORDER BY round(COALESCE(dc.total_coins, 0::bigint)::numeric / dt.total_employees::numeric, 1) DESC
  ) AS rank,
  dt.department_code,
  COALESCE(dc.users_earning, 0::bigint) AS users_earning,
  dt.total_employees,
  COALESCE(dc.total_coins, 0::bigint) AS total_coins,
  round(COALESCE(dc.total_coins, 0::bigint)::numeric / dt.total_employees::numeric, 1) AS contest_score,
  date_trunc('month', public.fn_minsk_today()::timestamp without time zone)::date AS period_start
FROM dept_totals dt
LEFT JOIN dept_coins dc ON dc.department_code = dt.department_code
WHERE COALESCE(dc.total_coins, 0::bigint) > 0
WITH NO DATA;

CREATE UNIQUE INDEX view_top_dept_ws_department_code_idx
  ON public.view_top_dept_ws (department_code);

-- Team WS leaderboard.
DROP MATERIALIZED VIEW IF EXISTS public.view_top_team_ws;
CREATE MATERIALIZED VIEW public.view_top_team_ws AS
WITH absent_today AS (
  SELECT DISTINCT a.user_id
  FROM public.ws_user_absences a
  WHERE a.absence_date = public.fn_minsk_today()
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
        SELECT at.user_id
        FROM absent_today at
        WHERE at.user_id IS NOT NULL
      )
    )
),
team_totals AS (
  SELECT eu.team, count(*) AS total_employees
  FROM eligible_users eu
  GROUP BY eu.team
),
team_coins AS (
  SELECT
    wu.team,
    count(DISTINCT t.user_id) AS users_earning,
    sum(t.coins) AS total_coins
  FROM public.gamification_transactions t
  JOIN public.gamification_event_logs e ON e.id = t.event_id
  JOIN public.ws_users wu ON wu.id = t.user_id
  JOIN eligible_users eu ON eu.id = wu.id
  WHERE e.source = 'ws'
    AND e.ranking_date >= date_trunc('month', public.fn_minsk_today()::timestamp without time zone)::date
    AND e.ranking_date <= public.fn_minsk_today()
  GROUP BY wu.team
)
SELECT
  row_number() OVER (
    ORDER BY round(COALESCE(tc.total_coins, 0::bigint)::numeric / tt.total_employees::numeric, 1) DESC
  ) AS rank,
  tt.team,
  COALESCE(tc.users_earning, 0::bigint) AS users_earning,
  tt.total_employees,
  COALESCE(tc.total_coins, 0::bigint) AS total_coins,
  round(COALESCE(tc.total_coins, 0::bigint)::numeric / tt.total_employees::numeric, 1) AS contest_score,
  date_trunc('month', public.fn_minsk_today()::timestamp without time zone)::date AS period_start
FROM team_totals tt
LEFT JOIN team_coins tc ON tc.team = tt.team
WHERE COALESCE(tc.total_coins, 0::bigint) > 0
WITH NO DATA;

CREATE UNIQUE INDEX idx_top_team_ws_team
  ON public.view_top_team_ws (team);
CREATE INDEX idx_top_team_ws_rank
  ON public.view_top_team_ws (rank);

REFRESH MATERIALIZED VIEW public.view_top_pers_ws;
REFRESH MATERIALIZED VIEW public.view_top_dept_ws;
REFRESH MATERIALIZED VIEW public.view_top_team_ws;

-- The 2026-10-01 WS achievement snapshot was produced from the old month
-- boundary. Rebuild that one day from ranking_date so achievement progress and
-- the visible leaderboard use the same attribution rule.
DELETE FROM public.ach_ranking_snapshots
WHERE area = 'ws'
  AND snapshot_date = DATE '2026-10-01';

WITH
bounds AS (
  SELECT DATE '2026-10-01' AS snapshot_date
),
personal_users AS (
  SELECT wu.id
  FROM public.ws_users wu
  WHERE wu.is_active = true
    AND wu.team IS DISTINCT FROM 'Декретный'
),
personal_coins AS (
  SELECT t.user_id, sum(t.coins) AS total_coins
  FROM public.gamification_transactions t
  JOIN public.gamification_event_logs e ON e.id = t.event_id
  JOIN personal_users pu ON pu.id = t.user_id
  CROSS JOIN bounds b
  WHERE e.source = 'ws'
    AND e.ranking_date BETWEEN date_trunc('month', b.snapshot_date)::date AND b.snapshot_date
  GROUP BY t.user_id
),
personal_ranked AS (
  SELECT
    pc.user_id,
    pc.total_coins,
    dense_rank() OVER (ORDER BY pc.total_coins DESC) AS rank
  FROM personal_coins pc
  WHERE pc.total_coins > 0
),
team_users AS (
  SELECT wu.id, wu.team
  FROM public.ws_users wu
  CROSS JOIN bounds b
  WHERE wu.is_active = true
    AND wu.team IS NOT NULL
    AND wu.team <> ''
    AND wu.team <> 'Декретный'
    AND NOT EXISTS (
      SELECT 1
      FROM public.ws_user_absences a
      WHERE a.user_id = wu.id
        AND a.absence_date = b.snapshot_date
    )
),
team_totals AS (
  SELECT tu.team, count(*) AS total_employees
  FROM team_users tu
  GROUP BY tu.team
),
team_coins AS (
  SELECT tu.team, sum(t.coins) AS total_coins
  FROM public.gamification_transactions t
  JOIN public.gamification_event_logs e ON e.id = t.event_id
  JOIN team_users tu ON tu.id = t.user_id
  CROSS JOIN bounds b
  WHERE e.source = 'ws'
    AND e.ranking_date BETWEEN date_trunc('month', b.snapshot_date)::date AND b.snapshot_date
  GROUP BY tu.team
),
team_ranked AS (
  SELECT
    tt.team,
    round(COALESCE(tc.total_coins, 0::bigint)::numeric / tt.total_employees::numeric, 1) AS score,
    row_number() OVER (
      ORDER BY round(COALESCE(tc.total_coins, 0::bigint)::numeric / tt.total_employees::numeric, 1) DESC
    ) AS rank
  FROM team_totals tt
  LEFT JOIN team_coins tc ON tc.team = tt.team
  WHERE COALESCE(tc.total_coins, 0::bigint) > 0
),
dept_users AS (
  SELECT wu.id, wu.department_code
  FROM public.ws_users wu
  CROSS JOIN bounds b
  WHERE wu.is_active = true
    AND wu.department_code IS NOT NULL
    AND wu.team IS DISTINCT FROM 'Декретный'
    AND NOT EXISTS (
      SELECT 1
      FROM public.ws_user_absences a
      WHERE a.user_id = wu.id
        AND a.absence_date = b.snapshot_date - 1
    )
),
dept_totals AS (
  SELECT du.department_code, count(*) AS total_employees
  FROM dept_users du
  GROUP BY du.department_code
),
dept_coins AS (
  SELECT du.department_code, sum(t.coins) AS total_coins
  FROM public.gamification_transactions t
  JOIN public.gamification_event_logs e ON e.id = t.event_id
  JOIN dept_users du ON du.id = t.user_id
  CROSS JOIN bounds b
  WHERE e.source = 'ws'
    AND e.ranking_date BETWEEN date_trunc('month', b.snapshot_date)::date AND b.snapshot_date
  GROUP BY du.department_code
),
dept_ranked AS (
  SELECT
    dt.department_code,
    round(COALESCE(dc.total_coins, 0::bigint)::numeric / dt.total_employees::numeric, 1) AS score,
    row_number() OVER (
      ORDER BY round(COALESCE(dc.total_coins, 0::bigint)::numeric / dt.total_employees::numeric, 1) DESC
    ) AS rank
  FROM dept_totals dt
  LEFT JOIN dept_coins dc ON dc.department_code = dt.department_code
  WHERE COALESCE(dc.total_coins, 0::bigint) > 0
),
snapshot_rows AS (
  SELECT
    pr.user_id::text AS entity_id,
    'user'::text AS entity_type,
    pr.rank::smallint AS rank,
    pr.total_coins::numeric AS score
  FROM personal_ranked pr
  WHERE pr.rank <= 10

  UNION ALL

  SELECT
    tr.team AS entity_id,
    'team'::text AS entity_type,
    tr.rank::smallint AS rank,
    tr.score
  FROM team_ranked tr
  WHERE tr.rank <= 5

  UNION ALL

  SELECT
    dr.department_code AS entity_id,
    'department'::text AS entity_type,
    dr.rank::smallint AS rank,
    dr.score
  FROM dept_ranked dr
  WHERE dr.rank <= 5
)
INSERT INTO public.ach_ranking_snapshots (
  entity_id,
  entity_type,
  area,
  rank,
  score,
  snapshot_date,
  period_start
)
SELECT
  sr.entity_id,
  sr.entity_type,
  'ws',
  sr.rank,
  sr.score,
  DATE '2026-10-01',
  DATE '2026-10-01'
FROM snapshot_rows sr;
