-- Align the new period dashboard with the established production cohort and streak rules.
-- Legacy production functions remain untouched.

CREATE OR REPLACE FUNCTION public.adoption_designer_cohort_v2()
RETURNS TABLE (
  id uuid,
  email text,
  first_name text,
  last_name text,
  department text,
  team text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT u.id, lower(u.email), u.first_name, u.last_name, u.department, NULLIF(u.team, '')
  FROM public.ws_users u
  WHERE u.is_active = true
    AND EXISTS (
      SELECT 1 FROM public.admin_department_groups g
      WHERE g.department = u.department AND g.group_type = 'designer'
    );
$fn$;

CREATE OR REPLACE FUNCTION public.get_adoption_period_plugins_v2(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE v_result jsonb;
BEGIN
  IF p_to IS NULL OR (p_from IS NOT NULL AND p_from>p_to) THEN RAISE EXCEPTION 'Invalid adoption period'; END IF;
  WITH
  cohort AS MATERIALIZED (
    SELECT c.*, EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.email)=c.email AND p.created_at<((p_to+1)::timestamp AT TIME ZONE 'Europe/Minsk')) AS logged_in
    FROM public.adoption_designer_cohort_v2() c
  ),
  src AS MATERIALIZED (
    SELECT lower(e.user_email) AS email,e.work_date,e.launch_count FROM public.elk_plugin_launches_baseline e WHERE lower(e.user_email) IN (SELECT email FROM cohort)
    UNION ALL
    SELECT lower(e.user_email),e.work_date,e.launch_count FROM public.elk_plugin_launches e WHERE lower(e.user_email) IN (SELECT email FROM cohort)
  ),
  bounds AS MATERIALIZED (
    SELECT COALESCE(p_from,(SELECT min(work_date) FROM src),p_to) AS effective_from
  ),
  all_days AS MATERIALIZED (
    SELECT generate_series(LEAST(DATE '2026-06-01',(SELECT effective_from FROM bounds)),p_to,interval '1 day')::date AS day
  ),
  workdays AS MATERIALIZED (
    SELECT day FROM all_days d WHERE EXISTS (SELECT 1 FROM public.calendar_workdays w WHERE w.date=d.day)
      OR (extract(isodow FROM d.day) BETWEEN 1 AND 5 AND NOT EXISTS (SELECT 1 FROM public.calendar_holidays h WHERE h.date=d.day))
  ),
  daily AS MATERIALIZED (
    SELECT w.day,count(DISTINCT s.email)::bigint AS users,COALESCE(sum(s.launch_count),0)::bigint AS launches
    FROM workdays w LEFT JOIN src s ON s.work_date=w.day GROUP BY w.day
  ),
  base_days AS MATERIALIZED (SELECT day FROM workdays WHERE day BETWEEN DATE '2026-06-01' AND DATE '2026-06-30'),
  effect_base_days AS MATERIALIZED (SELECT day FROM workdays WHERE day BETWEEN DATE '2026-06-29' AND DATE '2026-06-30'),
  period_days AS MATERIALIZED (SELECT day FROM workdays,bounds WHERE day BETWEEN effective_from AND p_to),
  after_days AS MATERIALIZED (SELECT day FROM period_days WHERE day>=DATE '2026-07-01'),
  base_users AS MATERIALIZED (SELECT DISTINCT email FROM src WHERE work_date BETWEEN DATE '2026-06-01' AND DATE '2026-06-30'),
  period_users AS MATERIALIZED (SELECT DISTINCT s.email FROM src s,bounds b WHERE s.work_date BETWEEN GREATEST(b.effective_from,DATE '2026-07-01') AND p_to),
  week_users AS MATERIALIZED (
    SELECT date_trunc('week',p.day)::date AS week,count(DISTINCT s.email)::bigint AS users
    FROM period_days p LEFT JOIN src s ON s.work_date=p.day GROUP BY 1
  )
  SELECT jsonb_build_object(
    'period_from',p_from,'period_to',p_to,'total_cohort',(SELECT count(*) FROM cohort),
    'daily_active_before',COALESCE((SELECT round(sum(d.users)::numeric/NULLIF(count(*),0)) FROM daily d JOIN base_days b ON b.day=d.day),0),
    'daily_active_after',COALESCE((SELECT round(sum(d.users)::numeric/NULLIF(count(*),0)) FROM daily d JOIN after_days p ON p.day=d.day),0),
    'launches_day_before',COALESCE((SELECT round(sum(d.launches)::numeric/NULLIF(count(*),0)) FROM daily d JOIN base_days b ON b.day=d.day),0),
    'launches_day_after',COALESCE((SELECT round(sum(d.launches)::numeric/NULLIF(count(*),0)) FROM daily d JOIN after_days p ON p.day=d.day),0),
    'new_users_after',(SELECT count(*) FROM period_users p WHERE NOT EXISTS (SELECT 1 FROM base_users b WHERE b.email=p.email)),
    'weekly_audience',COALESCE((SELECT round(avg(users)) FROM week_users),0),
    'daily',COALESCE((SELECT jsonb_agg(jsonb_build_object('day',d.day,'users',d.users,'launches',d.launches) ORDER BY d.day) FROM daily d JOIN period_days p ON p.day=d.day),'[]'::jsonb),
    'effect_logged',jsonb_build_object(
      'users',(SELECT count(*) FROM cohort WHERE logged_in),
      'active_before',COALESCE((SELECT round(1000.0*count(DISTINCT (s.email,s.work_date))/NULLIF((SELECT count(*) FROM effect_base_days)*(SELECT count(*) FROM cohort WHERE logged_in),0))/10 FROM src s JOIN cohort c ON c.email=s.email AND c.logged_in WHERE s.work_date IN (SELECT day FROM effect_base_days)),0),
      'active_after',COALESCE((SELECT round(1000.0*count(DISTINCT (s.email,s.work_date))/NULLIF((SELECT count(*) FROM after_days)*(SELECT count(*) FROM cohort WHERE logged_in),0))/10 FROM src s JOIN cohort c ON c.email=s.email AND c.logged_in WHERE s.work_date IN (SELECT day FROM after_days)),0)
    ),
    'effect_not_logged',jsonb_build_object(
      'users',(SELECT count(*) FROM cohort WHERE NOT logged_in),
      'active_before',COALESCE((SELECT round(1000.0*count(DISTINCT (s.email,s.work_date))/NULLIF((SELECT count(*) FROM effect_base_days)*(SELECT count(*) FROM cohort WHERE NOT logged_in),0))/10 FROM src s JOIN cohort c ON c.email=s.email AND NOT c.logged_in WHERE s.work_date IN (SELECT day FROM effect_base_days)),0),
      'active_after',COALESCE((SELECT round(1000.0*count(DISTINCT (s.email,s.work_date))/NULLIF((SELECT count(*) FROM after_days)*(SELECT count(*) FROM cohort WHERE NOT logged_in),0))/10 FROM src s JOIN cohort c ON c.email=s.email AND NOT c.logged_in WHERE s.work_date IN (SELECT day FROM after_days)),0)
    )
  ) INTO v_result;
  RETURN v_result;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.get_adoption_period_engagement_v2(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE v_result jsonb;
BEGIN
  IF p_to IS NULL OR (p_from IS NOT NULL AND p_from>p_to) THEN RAISE EXCEPTION 'Invalid adoption period'; END IF;
  WITH
  bounds AS MATERIALIZED (
    SELECT CASE WHEN p_from IS NULL THEN NULL ELSE p_from::timestamp AT TIME ZONE 'Europe/Minsk' END from_ts,
      (p_to+1)::timestamp AT TIME ZONE 'Europe/Minsk' to_ts
  ),
  cohort AS MATERIALIZED (SELECT * FROM public.adoption_designer_cohort_v2()),
  profiles_at_to AS MATERIALIZED (SELECT p.user_id,lower(p.email) email FROM public.profiles p,bounds b WHERE p.created_at<b.to_ts),
  grats AS MATERIALIZED (SELECT g.sender_id,g.recipient_id FROM public.gratitudes g JOIN cohort c ON c.id=g.sender_id CROSS JOIN bounds b WHERE (b.from_ts IS NULL OR g.created_at>=b.from_ts) AND g.created_at<b.to_ts),
  orders AS MATERIALIZED (SELECT o.user_id FROM public.shop_orders o JOIN cohort c ON c.id=o.user_id JOIN public.shop_products p ON p.id=o.product_id CROSS JOIN bounds b WHERE o.status<>'cancelled' AND p.effect IS NULL AND (b.from_ts IS NULL OR o.created_at>=b.from_ts) AND o.created_at<b.to_ts),
  shields AS MATERIALIZED (SELECT s.user_id FROM public.streak_shield_log s JOIN cohort c ON c.id=s.user_id CROSS JOIN bounds b WHERE (b.from_ts IS NULL OR s.created_at>=b.from_ts) AND s.created_at<b.to_ts),
  chats AS MATERIALIZED (SELECT m.user_id FROM public.chat_messages m JOIN profiles_at_to p ON p.user_id=m.user_id JOIN cohort c ON c.email=p.email CROSS JOIN bounds b WHERE m.role='user' AND (b.from_ts IS NULL OR m.created_at>=b.from_ts) AND m.created_at<b.to_ts),
  ws_walk AS MATERIALIZED (
    SELECT s.user_id,s.current_streak,s.pending_reset_expires_at,
      generate_series(
        CASE WHEN s.pending_reset_expires_at IS NOT NULL AND s.pending_reset_expires_at<=b.to_ts
          THEN (s.pending_reset_date+1)::timestamp ELSE s.streak_start_date::timestamp END,
        p_to::timestamp,interval '1 day'
      )::date AS day
    FROM public.ws_user_streaks s JOIN cohort c ON c.id=s.user_id CROSS JOIN bounds b
    WHERE s.streak_start_date IS NOT NULL OR s.pending_reset_date IS NOT NULL
  ),
  ws_computed AS MATERIALIZED (
    SELECT w.user_id,max(w.current_streak) stored_streak,max(w.pending_reset_expires_at) pending_expires,
      sum(CASE WHEN ds.status='green' THEN 1 WHEN ds.status='absent' THEN 0
        WHEN ds.status='red' THEN CASE WHEN EXISTS (SELECT 1 FROM public.streak_shield_log l WHERE l.user_id=w.user_id AND l.protected_date=w.day AND l.shield_type='ws') THEN 1 ELSE 0 END
        ELSE 1 END)::integer computed
    FROM ws_walk w LEFT JOIN public.ws_daily_statuses ds ON ds.user_id=w.user_id AND ds.date=w.day GROUP BY w.user_id
  ),
  ws_streak AS MATERIALIZED (
    SELECT c.id,CASE WHEN x.pending_expires IS NOT NULL AND x.pending_expires>b.to_ts THEN x.stored_streak ELSE COALESCE(x.computed,0) END streak
    FROM cohort c CROSS JOIN bounds b LEFT JOIN ws_computed x ON x.user_id=c.id
  ),
  rv_walk AS MATERIALIZED (
    SELECT s.user_id,c.email,s.current_streak,s.pending_reset_expires_at,
      generate_series(
        CASE WHEN s.pending_reset_expires_at IS NOT NULL AND s.pending_reset_expires_at<=b.to_ts
          THEN (s.pending_reset_date+1)::timestamp ELSE s.streak_start_date::timestamp END,
        p_to::timestamp,interval '1 day'
      )::date AS day
    FROM public.revit_user_streaks s JOIN cohort c ON c.id=s.user_id CROSS JOIN bounds b
    WHERE s.streak_start_date IS NOT NULL OR s.pending_reset_date IS NOT NULL
  ),
  rv_computed AS MATERIALIZED (
    SELECT w.user_id,max(w.current_streak) stored_streak,max(w.pending_reset_expires_at) pending_expires,
      sum(CASE
        WHEN EXISTS (SELECT 1 FROM public.ws_user_absences a WHERE a.user_email=w.email AND a.absence_date=w.day) THEN 0
        WHEN EXISTS (SELECT 1 FROM public.calendar_workdays cw WHERE cw.date=w.day) THEN CASE
          WHEN EXISTS (SELECT 1 FROM public.elk_plugin_launches l WHERE l.user_email=w.email AND l.work_date=w.day) THEN 1
          WHEN EXISTS (SELECT 1 FROM public.streak_shield_log l WHERE l.user_id=w.user_id AND l.protected_date=w.day AND l.shield_type='revit') THEN 1 ELSE 0 END
        WHEN extract(dow FROM w.day) IN (0,6) THEN 1
        WHEN EXISTS (SELECT 1 FROM public.calendar_holidays h WHERE h.date=w.day) THEN 1
        WHEN EXISTS (SELECT 1 FROM public.elk_plugin_launches l WHERE l.user_email=w.email AND l.work_date=w.day) THEN 1
        WHEN EXISTS (SELECT 1 FROM public.streak_shield_log l WHERE l.user_id=w.user_id AND l.protected_date=w.day AND l.shield_type='revit') THEN 1
        ELSE 0 END)::integer computed
    FROM rv_walk w GROUP BY w.user_id
  ),
  rv_streak AS MATERIALIZED (
    SELECT c.id,CASE WHEN x.pending_expires IS NOT NULL AND x.pending_expires>b.to_ts THEN x.stored_streak ELSE COALESCE(x.computed,0) END streak
    FROM cohort c CROSS JOIN bounds b LEFT JOIN rv_computed x ON x.user_id=c.id
  )
  SELECT jsonb_build_object(
    'gratitude_total',(SELECT count(*) FROM grats),'gratitude_senders',(SELECT count(DISTINCT sender_id) FROM grats),'gratitude_recipients',(SELECT count(DISTINCT recipient_id) FROM grats),
    'shop_orders_total',(SELECT count(*) FROM orders),'shop_orders_unique_users',(SELECT count(DISTINCT user_id) FROM orders),
    'second_life_total',(SELECT count(*) FROM shields),'second_life_users',(SELECT count(DISTINCT user_id) FROM shields),
    'chatbot_messages_total',(SELECT count(*) FROM chats),'chatbot_unique_users',(SELECT count(DISTINCT user_id) FROM chats),
    'ws_streak_holders',(SELECT count(*) FROM ws_streak WHERE streak>=1),'ws_streak_7plus',(SELECT count(*) FROM ws_streak WHERE streak>=7),
    'revit_streak_holders',(SELECT count(*) FROM rv_streak WHERE streak>=1),'revit_streak_7plus',(SELECT count(*) FROM rv_streak WHERE streak>=7)
  ) INTO v_result;
  RETURN v_result;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.get_adoption_monthly_summary_v3(p_from date,p_to date,p_scope text DEFAULT 'designer',p_departments text[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE v_result jsonb;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from>p_to THEN RAISE EXCEPTION 'Invalid monthly report period'; END IF;
  IF p_scope NOT IN ('designer','all','selected') THEN RAISE EXCEPTION 'Invalid cohort scope'; END IF;
  WITH
  bounds AS MATERIALIZED (SELECT p_from::timestamp AT TIME ZONE 'Europe/Minsk' from_ts,(p_to+1)::timestamp AT TIME ZONE 'Europe/Minsk' to_ts),
  cohort AS MATERIALIZED (
    SELECT u.id,lower(u.email) email FROM public.ws_users u
    WHERE u.is_active=true AND (
      p_scope='all' OR (p_scope='designer' AND EXISTS (SELECT 1 FROM public.admin_department_groups g WHERE g.department=u.department AND g.group_type='designer'))
      OR (p_scope='selected' AND u.department=ANY(COALESCE(p_departments,ARRAY[]::text[])))
    )
  ),
  actions AS MATERIALIZED (
    SELECT g.sender_id user_id,'gratitude' action FROM public.gratitudes g JOIN cohort c ON c.id=g.sender_id CROSS JOIN bounds b WHERE g.created_at>=b.from_ts AND g.created_at<b.to_ts
    UNION ALL SELECT o.user_id,'shop' FROM public.shop_orders o JOIN cohort c ON c.id=o.user_id JOIN public.shop_products p ON p.id=o.product_id CROSS JOIN bounds b WHERE o.status<>'cancelled' AND p.effect IS NULL AND o.created_at>=b.from_ts AND o.created_at<b.to_ts
    UNION ALL SELECT s.user_id,'shield' FROM public.streak_shield_log s JOIN cohort c ON c.id=s.user_id CROSS JOIN bounds b WHERE s.created_at>=b.from_ts AND s.created_at<b.to_ts
  ),
  statuses AS MATERIALIZED (
    SELECT s.user_id,s.status,s.red_reasons FROM public.ws_daily_statuses s JOIN cohort c ON c.id=s.user_id WHERE s.date BETWEEN p_from AND p_to
    UNION ALL SELECT s.user_id,s.status,s.red_reasons FROM public.ws_daily_statuses_baseline s JOIN cohort c ON c.id=s.user_id WHERE s.date BETWEEN p_from AND p_to
  ),
  tx AS MATERIALIZED (SELECT t.user_id,t.coins FROM public.gamification_transactions t JOIN cohort c ON c.id=t.user_id CROSS JOIN bounds b WHERE t.created_at>=b.from_ts AND t.created_at<b.to_ts)
  SELECT jsonb_build_object(
    'cohort_count',(SELECT count(*) FROM cohort),
    'registered_count',(SELECT count(*) FROM cohort c,bounds b WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.email)=c.email AND p.created_at<b.to_ts)),
    'gamification_active_count',(SELECT count(DISTINCT user_id) FROM actions),
    'gratitude_senders',(SELECT count(DISTINCT user_id) FROM actions WHERE action='gratitude'),
    'shop_buyers',(SELECT count(DISTINCT user_id) FROM actions WHERE action='shop'),
    'shield_users',(SELECT count(DISTINCT user_id) FROM actions WHERE action='shield'),
    'earned_coins',(SELECT COALESCE(sum(coins) FILTER (WHERE coins>0),0) FROM tx),
    'spent_coins',(SELECT COALESCE(-sum(coins) FILTER (WHERE coins<0),0) FROM tx),
    'green_pct',(SELECT round(100.0*count(*) FILTER (WHERE status='green')/NULLIF(count(*) FILTER (WHERE status IN ('green','red')),0),1) FROM statuses),
    'wrong_status_pct',(SELECT round(100.0*count(*) FILTER (WHERE status='red' AND red_reasons @> '[{"type":"wrong_status_report"}]')/NULLIF(count(*) FILTER (WHERE status IN ('green','red')),0),1) FROM statuses),
    'no_report_pct',(SELECT round(100.0*count(*) FILTER (WHERE status='red' AND red_reasons @> '[{"type":"red_day"}]')/NULLIF(count(*) FILTER (WHERE status IN ('green','red')),0),1) FROM statuses)
  ) INTO v_result;
  RETURN v_result;
END;
$fn$;

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
  team_totals AS (SELECT team,count(*)::bigint total_employees FROM cohort WHERE team IS NOT NULL AND team<>'' AND team NOT LIKE 'Вне команд%' GROUP BY team),
  team_coins AS (SELECT c.area,u.team,count(DISTINCT c.user_id)::bigint users_earning,sum(c.total_coins)::bigint total_coins FROM coins c JOIN cohort u ON u.id=c.user_id WHERE u.team IS NOT NULL AND u.team<>'' AND u.team NOT LIKE 'Вне команд%' GROUP BY c.area,u.team),
  teams_raw AS (
    SELECT tc.area,'team'::text level,tc.team entity_id,tc.team display_name,NULL::text department,tc.team,tc.total_coins,tc.users_earning,tt.total_employees,
      CASE WHEN tc.area='revit' THEN round(tc.total_coins::numeric*tc.users_earning/tt.total_employees,1) ELSE round(tc.total_coins::numeric/tt.total_employees,1) END contest_score
    FROM team_coins tc JOIN team_totals tt ON tt.team=tc.team WHERE tc.total_coins>0
  ),
  teams AS (SELECT tr.*,row_number() OVER(PARTITION BY tr.area ORDER BY tr.contest_score DESC,tr.display_name)::bigint rank FROM teams_raw tr),
  dept_totals AS (SELECT department,count(*)::bigint total_employees FROM cohort WHERE department IS NOT NULL GROUP BY department),
  dept_coins AS (SELECT c.area,u.department,count(DISTINCT c.user_id)::bigint users_earning,sum(c.total_coins)::bigint total_coins FROM coins c JOIN cohort u ON u.id=c.user_id WHERE u.department IS NOT NULL GROUP BY c.area,u.department),
  depts_raw AS (
    SELECT dc.area,'department'::text level,dc.department entity_id,dc.department display_name,dc.department,NULL::text team,dc.total_coins,dc.users_earning,dt.total_employees,
      CASE WHEN dc.area='revit' THEN round(dc.total_coins::numeric*dc.users_earning/dt.total_employees,1) ELSE round(dc.total_coins::numeric/dt.total_employees,1) END contest_score
    FROM dept_coins dc JOIN dept_totals dt ON dt.department=dc.department WHERE dc.total_coins>0
  ),
  depts AS (SELECT dr.*,row_number() OVER(PARTITION BY dr.area ORDER BY dr.contest_score DESC,dr.display_name)::bigint rank FROM depts_raw dr),
  all_rows AS (SELECT * FROM personal UNION ALL SELECT area,level,rank,entity_id,display_name,department,team,total_coins,users_earning,total_employees,contest_score FROM teams UNION ALL SELECT area,level,rank,entity_id,display_name,department,team,total_coins,users_earning,total_employees,contest_score FROM depts)
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
