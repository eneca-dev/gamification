-- Месячный отчёт по внедрению: данные читаются только серверной ролью.
-- p_scope: designer | all | selected; p_departments используется только для selected.

CREATE OR REPLACE FUNCTION public.get_adoption_monthly_summary(
  p_from date,
  p_to date,
  p_scope text DEFAULT 'designer',
  p_departments text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_result jsonb;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Invalid monthly report period';
  END IF;
  IF p_scope NOT IN ('designer', 'all', 'selected') THEN
    RAISE EXCEPTION 'Invalid cohort scope';
  END IF;

  WITH cohort AS (
    SELECT u.id, lower(u.email) AS email
    FROM ws_users u
    WHERE u.is_active = true AND u.team IS DISTINCT FROM 'Декретный'
      AND (
        p_scope = 'all'
        OR (p_scope = 'designer' AND EXISTS (
          SELECT 1 FROM admin_department_groups g
          WHERE g.department = u.department AND g.group_type = 'designer'
        ))
        OR (p_scope = 'selected' AND u.department = ANY(COALESCE(p_departments, ARRAY[]::text[])))
      )
  ), actions AS (
    SELECT g.sender_id AS user_id, 'gratitude'::text AS action
    FROM gratitudes g
    WHERE g.created_at >= p_from AND g.created_at < p_to + 1
      AND g.sender_id IN (SELECT id FROM cohort)
    UNION
    SELECT o.user_id, 'shop'::text
    FROM shop_orders o
    WHERE o.created_at >= p_from AND o.created_at < p_to + 1
      AND o.status <> 'cancelled' AND o.user_id IN (SELECT id FROM cohort)
    UNION
    SELECT s.user_id, 'shield'::text
    FROM streak_shield_log s
    WHERE s.created_at >= p_from AND s.created_at < p_to + 1
      AND s.user_id IN (SELECT id FROM cohort)
  ), statuses AS (
    SELECT user_id, date, status, red_reasons FROM ws_daily_statuses
    WHERE date BETWEEN p_from AND p_to AND user_id IN (SELECT id FROM cohort)
    UNION ALL
    SELECT user_id, date, status, red_reasons FROM ws_daily_statuses_baseline
    WHERE date BETWEEN p_from AND p_to AND user_id IN (SELECT id FROM cohort)
  ), tx AS (
    SELECT t.user_id, t.coins
    FROM gamification_transactions t
    WHERE t.created_at >= p_from AND t.created_at < p_to + 1
      AND t.user_id IN (SELECT id FROM cohort)
  )
  SELECT jsonb_build_object(
    'cohort_count', (SELECT count(*) FROM cohort),
    'registered_count', (SELECT count(*) FROM cohort c WHERE EXISTS (SELECT 1 FROM profiles p WHERE lower(p.email) = c.email)),
    'gamification_active_count', (SELECT count(DISTINCT user_id) FROM actions),
    'gratitude_senders', (SELECT count(DISTINCT user_id) FROM actions WHERE action = 'gratitude'),
    'shop_buyers', (SELECT count(DISTINCT user_id) FROM actions WHERE action = 'shop'),
    'shield_users', (SELECT count(DISTINCT user_id) FROM actions WHERE action = 'shield'),
    'earned_coins', (SELECT coalesce(sum(coins) FILTER (WHERE coins > 0), 0) FROM tx),
    'spent_coins', (SELECT abs(coalesce(sum(coins) FILTER (WHERE coins < 0), 0)) FROM tx),
    'green_pct', (SELECT round(100.0 * count(*) FILTER (WHERE status = 'green') / nullif(count(*) FILTER (WHERE status IN ('green','red')), 0), 1) FROM statuses),
    'wrong_status_pct', (SELECT round(100.0 * count(*) FILTER (WHERE status = 'red' AND red_reasons @> '[{"type":"wrong_status_report"}]'::jsonb) / nullif(count(*) FILTER (WHERE status IN ('green','red')), 0), 1) FROM statuses),
    'no_report_pct', (SELECT round(100.0 * count(*) FILTER (WHERE status = 'red' AND red_reasons @> '[{"type":"red_day"}]'::jsonb) / nullif(count(*) FILTER (WHERE status IN ('green','red')), 0), 1) FROM statuses)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_adoption_monthly_rankings(
  p_from date,
  p_to date,
  p_scope text DEFAULT 'designer',
  p_departments text[] DEFAULT NULL
)
RETURNS TABLE (
  area text, level text, rank bigint, entity_id text, display_name text,
  department text, team text, total_coins bigint, users_earning bigint,
  total_employees bigint, contest_score numeric, is_winner boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN RAISE EXCEPTION 'Invalid monthly report period'; END IF;
  IF p_scope NOT IN ('designer', 'all', 'selected') THEN RAISE EXCEPTION 'Invalid cohort scope'; END IF;

  RETURN QUERY
  WITH cohort AS (
    SELECT u.id, u.first_name, u.last_name, u.department, u.team
    FROM ws_users u
    WHERE u.is_active = true AND u.team IS DISTINCT FROM 'Декретный'
      AND (
        p_scope = 'all'
        OR (p_scope = 'designer' AND EXISTS (SELECT 1 FROM admin_department_groups g WHERE g.department = u.department AND g.group_type = 'designer'))
        OR (p_scope = 'selected' AND u.department = ANY(COALESCE(p_departments, ARRAY[]::text[])))
      )
  ), coins AS (
    SELECT e.source AS area, t.user_id, sum(t.coins)::bigint AS total_coins
    FROM gamification_transactions t JOIN gamification_event_logs e ON e.id = t.event_id
    WHERE e.source IN ('revit','ws') AND e.event_date BETWEEN p_from AND p_to
      AND t.user_id IN (SELECT id FROM cohort)
    GROUP BY e.source, t.user_id
  ), personal AS (
    SELECT c.area, 'personal'::text AS level, dense_rank() OVER (PARTITION BY c.area ORDER BY c.total_coins DESC)::bigint AS rank,
      c.user_id::text AS entity_id, trim(coalesce(u.last_name,'') || ' ' || coalesce(u.first_name,'')) AS display_name,
      u.department, u.team, c.total_coins, 1::bigint AS users_earning, 1::bigint AS total_employees, c.total_coins::numeric AS contest_score
    FROM coins c JOIN cohort u ON u.id = c.user_id WHERE c.total_coins > 0
  ), team_totals AS (
    SELECT team, count(*)::bigint AS total_employees FROM cohort
    WHERE team IS NOT NULL AND team <> '' AND team NOT LIKE 'Вне команд%'
    GROUP BY team
  ), team_coins AS (
    SELECT c.area, u.team, count(DISTINCT c.user_id)::bigint AS users_earning, sum(c.total_coins)::bigint AS total_coins
    FROM coins c JOIN cohort u ON u.id = c.user_id
    WHERE u.team IS NOT NULL AND u.team <> '' AND u.team NOT LIKE 'Вне команд%'
    GROUP BY c.area, u.team
  ), teams_raw AS (
    SELECT tc.area, 'team'::text AS level, tc.team AS entity_id, tc.team AS display_name,
      NULL::text AS department, tc.team, tc.total_coins, tc.users_earning, tt.total_employees,
      CASE WHEN tc.area = 'revit' THEN round(tc.total_coins::numeric * tc.users_earning / tt.total_employees, 1)
           ELSE round(tc.total_coins::numeric / tt.total_employees, 1) END AS contest_score
    FROM team_coins tc JOIN team_totals tt ON tt.team = tc.team WHERE tc.total_coins > 0
  ), teams AS (
    SELECT tr.*, row_number() OVER (PARTITION BY area ORDER BY contest_score DESC, display_name)::bigint AS rank FROM teams_raw tr
  ), dept_totals AS (
    SELECT department, count(*)::bigint AS total_employees FROM cohort WHERE department IS NOT NULL GROUP BY department
  ), dept_coins AS (
    SELECT c.area, u.department, count(DISTINCT c.user_id)::bigint AS users_earning, sum(c.total_coins)::bigint AS total_coins
    FROM coins c JOIN cohort u ON u.id = c.user_id WHERE u.department IS NOT NULL GROUP BY c.area, u.department
  ), depts_raw AS (
    SELECT dc.area, 'department'::text AS level, dc.department AS entity_id, dc.department AS display_name,
      dc.department, NULL::text AS team, dc.total_coins, dc.users_earning, dt.total_employees,
      CASE WHEN dc.area = 'revit' THEN round(dc.total_coins::numeric * dc.users_earning / dt.total_employees, 1)
           ELSE round(dc.total_coins::numeric / dt.total_employees, 1) END AS contest_score
    FROM dept_coins dc JOIN dept_totals dt ON dt.department = dc.department WHERE dc.total_coins > 0
  ), depts AS (
    SELECT dr.*, row_number() OVER (PARTITION BY area ORDER BY contest_score DESC, display_name)::bigint AS rank FROM depts_raw dr
  ), all_rows AS (
    SELECT * FROM personal UNION ALL SELECT * FROM teams UNION ALL SELECT * FROM depts
  )
  SELECT r.area, r.level, r.rank, r.entity_id, r.display_name, r.department, r.team,
    r.total_coins, r.users_earning, r.total_employees, r.contest_score,
    EXISTS (
      SELECT 1 FROM gamification_event_logs e
      WHERE e.details->>'contest_month' = to_char(p_from, 'YYYY-MM')
        AND ((r.area='revit' AND r.level='team' AND e.event_type='revit_team_contest_top1_bonus' AND e.details->>'team'=r.entity_id)
          OR (r.area='revit' AND r.level='department' AND e.event_type='team_contest_top1_bonus' AND e.details->>'department'=r.entity_id)
          OR (r.area='ws' AND r.level='team' AND e.event_type='ws_team_contest_top1_bonus' AND e.details->>'team'=r.entity_id)
          OR (r.area='ws' AND r.level='department' AND e.event_type='ws_dept_contest_top1_bonus' AND e.details->>'department'=r.entity_id))
    ) AS is_winner
  FROM all_rows r
  ORDER BY r.area, r.level, r.rank;
END;
$$;

REVOKE ALL ON FUNCTION public.get_adoption_monthly_summary(date,date,text,text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_adoption_monthly_rankings(date,date,text,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_adoption_monthly_summary(date,date,text,text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_adoption_monthly_rankings(date,date,text,text[]) TO service_role;
