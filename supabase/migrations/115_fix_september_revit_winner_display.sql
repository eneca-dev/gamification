-- Display only the corrected September 2026 Revit winners while preserving
-- every previously granted crystal and transaction.

INSERT INTO public.gamification_event_types (
  key,
  name,
  coins,
  is_active,
  description
)
VALUES (
  'contest_reward_preserved',
  'Сохранённая награда после исправления итогов',
  0,
  false,
  'Ранее начисленная конкурсная награда сохранена, но событие больше не определяет победителя'
)
ON CONFLICT (key) DO UPDATE
SET name = EXCLUDED.name,
    coins = EXCLUDED.coins,
    is_active = EXCLUDED.is_active,
    description = EXCLUDED.description;

-- Keep the original transactions and balances, but stop treating the two
-- superseded September results as winner records.
UPDATE public.gamification_event_logs
SET event_type = 'contest_reward_preserved',
    details = details || jsonb_build_object(
      'original_event_type', event_type,
      'winner_record_superseded', true,
      'superseded_reason', 'revit_contest_formula_alignment',
      'superseded_at', now()
    )
WHERE details->>'contest_month' = '2026-09'
  AND (
    (
      event_type = 'team_contest_top1_bonus'
      AND details->>'department' = 'КР гражд'
    )
    OR
    (
      event_type = 'revit_team_contest_top1_bonus'
      AND details->>'team' = 'Вне команд АР пром'
    )
  );

-- The monthly report now uses the same Revit score as the production
-- leaderboards and identifies departments by department_code, matching the
-- contest award events.
CREATE OR REPLACE FUNCTION public.get_adoption_monthly_rankings_v2(
  p_from date,
  p_to date,
  p_scope text DEFAULT 'designer',
  p_departments text[] DEFAULT NULL
)
RETURNS TABLE (
  area text,
  level text,
  rank bigint,
  entity_id text,
  display_name text,
  department text,
  team text,
  total_coins bigint,
  users_earning bigint,
  total_employees bigint,
  contest_score numeric,
  is_winner boolean
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
#variable_conflict use_column
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Invalid monthly report period';
  END IF;

  IF p_scope NOT IN ('designer', 'all', 'selected') THEN
    RAISE EXCEPTION 'Invalid cohort scope';
  END IF;

  RETURN QUERY
  WITH cohort AS MATERIALIZED (
    SELECT
      u.id,
      u.first_name,
      u.last_name,
      u.department,
      u.department_code,
      u.team
    FROM public.ws_users u
    WHERE u.is_active = true
      AND (
        p_scope = 'all'
        OR (
          p_scope = 'designer'
          AND EXISTS (
            SELECT 1
            FROM public.admin_department_groups g
            WHERE g.department = u.department
              AND g.group_type = 'designer'
          )
        )
        OR (
          p_scope = 'selected'
          AND u.department = ANY(coalesce(p_departments, ARRAY[]::text[]))
        )
      )
  ),
  coins AS MATERIALIZED (
    SELECT
      e.source AS area,
      t.user_id,
      sum(t.coins)::bigint AS total_coins
    FROM public.gamification_transactions t
    JOIN public.gamification_event_logs e ON e.id = t.event_id
    WHERE e.source IN ('revit', 'ws')
      AND e.event_date BETWEEN p_from AND p_to
      AND t.user_id IN (SELECT id FROM cohort)
    GROUP BY e.source, t.user_id
  ),
  personal AS (
    SELECT
      c.area,
      'personal'::text AS level,
      dense_rank() OVER (
        PARTITION BY c.area
        ORDER BY c.total_coins DESC
      )::bigint AS rank,
      c.user_id::text AS entity_id,
      trim(coalesce(u.last_name, '') || ' ' || coalesce(u.first_name, '')) AS display_name,
      u.department,
      u.team,
      c.total_coins,
      1::bigint AS users_earning,
      1::bigint AS total_employees,
      c.total_coins::numeric AS contest_score
    FROM coins c
    JOIN cohort u ON u.id = c.user_id
    WHERE c.total_coins > 0
  ),
  team_totals AS (
    SELECT c.team, count(*)::bigint AS total_employees
    FROM cohort c
    WHERE c.team IS NOT NULL
      AND c.team <> ''
      AND c.team NOT LIKE 'Вне команд%'
    GROUP BY c.team
  ),
  team_coins AS (
    SELECT
      c.area,
      u.team,
      count(DISTINCT c.user_id)::bigint AS users_earning,
      sum(c.total_coins)::bigint AS total_coins
    FROM coins c
    JOIN cohort u ON u.id = c.user_id
    WHERE u.team IS NOT NULL
      AND u.team <> ''
      AND u.team NOT LIKE 'Вне команд%'
    GROUP BY c.area, u.team
  ),
  teams_raw AS (
    SELECT
      tc.area,
      'team'::text AS level,
      tc.team AS entity_id,
      tc.team AS display_name,
      NULL::text AS department,
      tc.team,
      tc.total_coins,
      tc.users_earning,
      tt.total_employees,
      CASE
        WHEN tc.area = 'revit' THEN round(
          tc.total_coins::numeric
          * tc.users_earning
          / tt.total_employees
          / tt.total_employees,
          1
        )
        ELSE round(tc.total_coins::numeric / tt.total_employees, 1)
      END AS contest_score
    FROM team_coins tc
    JOIN team_totals tt ON tt.team = tc.team
    WHERE tc.total_coins > 0
  ),
  teams AS (
    SELECT
      tr.*,
      row_number() OVER (
        PARTITION BY tr.area
        ORDER BY tr.contest_score DESC, tr.display_name
      )::bigint AS rank
    FROM teams_raw tr
  ),
  department_totals AS (
    SELECT
      c.department_code,
      max(c.department) AS department,
      count(*)::bigint AS total_employees
    FROM cohort c
    WHERE c.department_code IS NOT NULL
    GROUP BY c.department_code
  ),
  department_coins AS (
    SELECT
      c.area,
      u.department_code,
      count(DISTINCT c.user_id)::bigint AS users_earning,
      sum(c.total_coins)::bigint AS total_coins
    FROM coins c
    JOIN cohort u ON u.id = c.user_id
    WHERE u.department_code IS NOT NULL
    GROUP BY c.area, u.department_code
  ),
  departments_raw AS (
    SELECT
      dc.area,
      'department'::text AS level,
      dc.department_code AS entity_id,
      coalesce(dt.department, dc.department_code) AS display_name,
      coalesce(dt.department, dc.department_code) AS department,
      NULL::text AS team,
      dc.total_coins,
      dc.users_earning,
      dt.total_employees,
      CASE
        WHEN dc.area = 'revit' THEN round(
          dc.total_coins::numeric
          * dc.users_earning
          / dt.total_employees
          / dt.total_employees,
          1
        )
        ELSE round(dc.total_coins::numeric / dt.total_employees, 1)
      END AS contest_score
    FROM department_coins dc
    JOIN department_totals dt ON dt.department_code = dc.department_code
    WHERE dc.total_coins > 0
  ),
  departments AS (
    SELECT
      dr.*,
      row_number() OVER (
        PARTITION BY dr.area
        ORDER BY dr.contest_score DESC, dr.display_name
      )::bigint AS rank
    FROM departments_raw dr
  ),
  all_rows AS (
    SELECT
      p.area, p.level, p.rank, p.entity_id, p.display_name, p.department,
      p.team, p.total_coins, p.users_earning, p.total_employees, p.contest_score
    FROM personal p
    UNION ALL
    SELECT
      t.area, t.level, t.rank, t.entity_id, t.display_name, t.department,
      t.team, t.total_coins, t.users_earning, t.total_employees, t.contest_score
    FROM teams t
    UNION ALL
    SELECT
      d.area, d.level, d.rank, d.entity_id, d.display_name, d.department,
      d.team, d.total_coins, d.users_earning, d.total_employees, d.contest_score
    FROM departments d
  )
  SELECT
    r.area,
    r.level,
    r.rank,
    r.entity_id,
    r.display_name,
    r.department,
    r.team,
    r.total_coins,
    r.users_earning,
    r.total_employees,
    r.contest_score,
    EXISTS (
      SELECT 1
      FROM public.gamification_event_logs e
      WHERE e.details->>'contest_month' = to_char(p_from, 'YYYY-MM')
        AND (
          (
            r.area = 'revit'
            AND r.level = 'team'
            AND e.event_type = 'revit_team_contest_top1_bonus'
            AND e.details->>'team' = r.entity_id
          )
          OR (
            r.area = 'revit'
            AND r.level = 'department'
            AND e.event_type = 'team_contest_top1_bonus'
            AND e.details->>'department' = r.entity_id
          )
          OR (
            r.area = 'ws'
            AND r.level = 'team'
            AND e.event_type = 'ws_team_contest_top1_bonus'
            AND e.details->>'team' = r.entity_id
          )
          OR (
            r.area = 'ws'
            AND r.level = 'department'
            AND e.event_type = 'ws_dept_contest_top1_bonus'
            AND e.details->>'department' = r.entity_id
          )
        )
    ) AS is_winner
  FROM all_rows r
  ORDER BY r.area, r.level, r.rank;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_adoption_monthly_rankings_v2(date, date, text, text[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_adoption_monthly_rankings_v2(date, date, text, text[])
  TO service_role;
