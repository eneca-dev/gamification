-- Resolve output-parameter/CTE column name conflicts in the new monthly rankings RPC.
-- No tables or data are changed.

CREATE OR REPLACE FUNCTION public.get_adoption_monthly_rankings_v2(
  p_from date,p_to date,p_scope text DEFAULT 'designer',p_departments text[] DEFAULT NULL
)
RETURNS TABLE (
  area text,level text,rank bigint,entity_id text,display_name text,
  department text,team text,total_coins bigint,users_earning bigint,
  total_employees bigint,contest_score numeric,is_winner boolean
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
#variable_conflict use_column
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from>p_to THEN RAISE EXCEPTION 'Invalid monthly report period'; END IF;
  IF p_scope NOT IN ('designer','all','selected') THEN RAISE EXCEPTION 'Invalid cohort scope'; END IF;
  RETURN QUERY
  WITH cohort AS MATERIALIZED (
    SELECT u.id,u.first_name,u.last_name,u.department,u.team FROM public.ws_users u
    WHERE u.is_active=true AND (
      p_scope='all' OR (p_scope='designer' AND EXISTS (SELECT 1 FROM public.admin_department_groups g WHERE g.department=u.department AND g.group_type='designer'))
      OR (p_scope='selected' AND u.department=ANY(COALESCE(p_departments,ARRAY[]::text[])))
    )
  ),
  coins AS MATERIALIZED (
    SELECT e.source area,t.user_id,sum(t.coins)::bigint total_coins
    FROM public.gamification_transactions t JOIN public.gamification_event_logs e ON e.id=t.event_id
    WHERE e.source IN ('revit','ws') AND e.event_date BETWEEN p_from AND p_to AND t.user_id IN (SELECT id FROM cohort)
    GROUP BY e.source,t.user_id
  ),
  personal AS (
    SELECT c.area,'personal'::text level,dense_rank() OVER(PARTITION BY c.area ORDER BY c.total_coins DESC)::bigint rank,
      c.user_id::text entity_id,trim(COALESCE(u.last_name,'')||' '||COALESCE(u.first_name,'')) display_name,
      u.department,u.team,c.total_coins,1::bigint users_earning,1::bigint total_employees,c.total_coins::numeric contest_score
    FROM coins c JOIN cohort u ON u.id=c.user_id WHERE c.total_coins>0
  ),
  team_totals AS (SELECT c.team,count(*)::bigint total_employees FROM cohort c WHERE c.team IS NOT NULL AND c.team<>'' AND c.team NOT LIKE 'Вне команд%' GROUP BY c.team),
  team_coins AS (SELECT c.area,u.team,count(DISTINCT c.user_id)::bigint users_earning,sum(c.total_coins)::bigint total_coins FROM coins c JOIN cohort u ON u.id=c.user_id WHERE u.team IS NOT NULL AND u.team<>'' AND u.team NOT LIKE 'Вне команд%' GROUP BY c.area,u.team),
  teams_raw AS (
    SELECT tc.area,'team'::text level,tc.team entity_id,tc.team display_name,NULL::text department,tc.team,tc.total_coins,tc.users_earning,tt.total_employees,
      CASE WHEN tc.area='revit' THEN round(tc.total_coins::numeric*tc.users_earning/tt.total_employees,1) ELSE round(tc.total_coins::numeric/tt.total_employees,1) END contest_score
    FROM team_coins tc JOIN team_totals tt ON tt.team=tc.team WHERE tc.total_coins>0
  ),
  teams AS (SELECT tr.*,row_number() OVER(PARTITION BY tr.area ORDER BY tr.contest_score DESC,tr.display_name)::bigint rank FROM teams_raw tr),
  dept_totals AS (SELECT c.department,count(*)::bigint total_employees FROM cohort c WHERE c.department IS NOT NULL GROUP BY c.department),
  dept_coins AS (SELECT c.area,u.department,count(DISTINCT c.user_id)::bigint users_earning,sum(c.total_coins)::bigint total_coins FROM coins c JOIN cohort u ON u.id=c.user_id WHERE u.department IS NOT NULL GROUP BY c.area,u.department),
  depts_raw AS (
    SELECT dc.area,'department'::text level,dc.department entity_id,dc.department display_name,dc.department,NULL::text team,dc.total_coins,dc.users_earning,dt.total_employees,
      CASE WHEN dc.area='revit' THEN round(dc.total_coins::numeric*dc.users_earning/dt.total_employees,1) ELSE round(dc.total_coins::numeric/dt.total_employees,1) END contest_score
    FROM dept_coins dc JOIN dept_totals dt ON dt.department=dc.department WHERE dc.total_coins>0
  ),
  depts AS (SELECT dr.*,row_number() OVER(PARTITION BY dr.area ORDER BY dr.contest_score DESC,dr.display_name)::bigint rank FROM depts_raw dr),
  all_rows AS (
    SELECT p.area,p.level,p.rank,p.entity_id,p.display_name,p.department,p.team,p.total_coins,p.users_earning,p.total_employees,p.contest_score FROM personal p
    UNION ALL SELECT t.area,t.level,t.rank,t.entity_id,t.display_name,t.department,t.team,t.total_coins,t.users_earning,t.total_employees,t.contest_score FROM teams t
    UNION ALL SELECT d.area,d.level,d.rank,d.entity_id,d.display_name,d.department,d.team,d.total_coins,d.users_earning,d.total_employees,d.contest_score FROM depts d
  )
  SELECT r.area,r.level,r.rank,r.entity_id,r.display_name,r.department,r.team,r.total_coins,r.users_earning,r.total_employees,r.contest_score,
    EXISTS (SELECT 1 FROM public.gamification_event_logs e WHERE e.details->>'contest_month'=to_char(p_from,'YYYY-MM') AND (
      (r.area='revit' AND r.level='team' AND e.event_type='revit_team_contest_top1_bonus' AND e.details->>'team'=r.entity_id)
      OR (r.area='revit' AND r.level='department' AND e.event_type='team_contest_top1_bonus' AND e.details->>'department'=r.entity_id)
      OR (r.area='ws' AND r.level='team' AND e.event_type='ws_team_contest_top1_bonus' AND e.details->>'team'=r.entity_id)
      OR (r.area='ws' AND r.level='department' AND e.event_type='ws_dept_contest_top1_bonus' AND e.details->>'department'=r.entity_id)
    )) is_winner
  FROM all_rows r ORDER BY r.area,r.level,r.rank;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_adoption_monthly_rankings_v2(date,date,text,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_adoption_monthly_rankings_v2(date,date,text,text[]) TO service_role;
