-- Keep the v2 contract, replace per-user/per-day correlated scans with window aggregates.
CREATE OR REPLACE FUNCTION public.get_adoption_period_core_v2(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE v_result jsonb;
BEGIN
  IF p_to IS NULL OR (p_from IS NOT NULL AND p_from > p_to) THEN RAISE EXCEPTION 'Invalid adoption period'; END IF;
  WITH
  bounds AS MATERIALIZED (
    SELECT CASE WHEN p_from IS NULL THEN NULL ELSE p_from::timestamp AT TIME ZONE 'Europe/Minsk' END AS from_ts,
      (p_to+1)::timestamp AT TIME ZONE 'Europe/Minsk' AS to_ts,
      COALESCE(p_from,(SELECT LEAST(
        COALESCE((SELECT min((created_at AT TIME ZONE 'Europe/Minsk')::date) FROM public.profiles),p_to),
        COALESCE((SELECT min(date) FROM public.ws_daily_statuses_baseline),p_to),
        COALESCE((SELECT min(work_date) FROM public.elk_plugin_launches_baseline),p_to)
      ))) AS effective_from
  ),
  cohort AS MATERIALIZED (
    SELECT c.*,EXISTS (SELECT 1 FROM public.profiles p,bounds b WHERE lower(p.email)=c.email AND p.created_at<b.to_ts) AS logged_in
    FROM public.adoption_designer_cohort_v2() c
  ),
  period_tx AS MATERIALIZED (
    SELECT t.user_id,t.coins FROM public.gamification_transactions t JOIN cohort c ON c.id=t.user_id CROSS JOIN bounds b
    WHERE (b.from_ts IS NULL OR t.created_at>=b.from_ts) AND t.created_at<b.to_ts
  ),
  days AS MATERIALIZED (SELECT generate_series(effective_from,p_to,interval '1 day')::date AS day FROM bounds),
  improvement_days AS MATERIALIZED (SELECT day FROM days WHERE day>=DATE '2026-07-01'),
  logins AS MATERIALIZED (
    SELECT c.id,min((p.created_at AT TIME ZONE 'Europe/Minsk')::date) login_day FROM cohort c LEFT JOIN public.profiles p ON lower(p.email)=c.email GROUP BY c.id
  ),
  status_source AS MATERIALIZED (
    SELECT s.user_id,s.date,s.status FROM public.ws_daily_statuses_baseline s JOIN cohort c ON c.id=s.user_id
    UNION ALL SELECT s.user_id,s.date,s.status FROM public.ws_daily_statuses s JOIN cohort c ON c.id=s.user_id
  ),
  ws_base AS MATERIALIZED (
    SELECT c.id,c.logged_in,count(*) FILTER (WHERE s.status='green')::numeric/NULLIF(count(*) FILTER (WHERE s.status IN ('green','red')),0) ratio
    FROM cohort c LEFT JOIN status_source s ON s.user_id=c.id AND s.date BETWEEN DATE '2026-06-29' AND DATE '2026-06-30'
    GROUP BY c.id,c.logged_in
  ),
  ws_grid AS MATERIALIZED (
    SELECT d.day,b.id,b.logged_in,b.ratio,
      count(s.*) FILTER (WHERE s.status='green') AS green_day,
      count(s.*) FILTER (WHERE s.status IN ('green','red')) AS tracked_day
    FROM improvement_days d CROSS JOIN ws_base b
    LEFT JOIN status_source s ON s.user_id=b.id AND s.date=d.day
    GROUP BY d.day,b.id,b.logged_in,b.ratio
  ),
  ws_running AS MATERIALIZED (
    SELECT day,id,logged_in,ratio,
      sum(green_day) OVER (PARTITION BY id ORDER BY day) AS green_total,
      sum(tracked_day) OVER (PARTITION BY id ORDER BY day) AS tracked_total
    FROM ws_grid
  ),
  ws_improved AS MATERIALIZED (
    SELECT day,logged_in,count(*) FILTER (WHERE green_total::numeric/NULLIF(tracked_total,0)>ratio)::bigint cnt
    FROM ws_running WHERE ratio IS NOT NULL GROUP BY day,logged_in
  ),
  calendar_days AS MATERIALIZED (
    SELECT d.day,(EXISTS (SELECT 1 FROM public.calendar_workdays w WHERE w.date=d.day)
      OR (extract(isodow FROM d.day) BETWEEN 1 AND 5 AND NOT EXISTS (SELECT 1 FROM public.calendar_holidays h WHERE h.date=d.day))) AS is_workday
    FROM improvement_days d
  ),
  rv_base AS MATERIALIZED (
    SELECT c.id,c.email,c.logged_in,COALESCE(sum(e.launch_count),0)::numeric/2 per_day
    FROM cohort c LEFT JOIN public.elk_plugin_launches_baseline e ON lower(e.user_email)=c.email AND e.work_date BETWEEN DATE '2026-06-29' AND DATE '2026-06-30'
    GROUP BY c.id,c.email,c.logged_in
  ),
  rv_daily AS MATERIALIZED (
    SELECT lower(e.user_email) email,e.work_date,sum(e.launch_count)::bigint launches
    FROM public.elk_plugin_launches e JOIN cohort c ON c.email=lower(e.user_email)
    WHERE e.work_date BETWEEN DATE '2026-07-01' AND p_to GROUP BY 1,2
  ),
  rv_grid AS MATERIALIZED (
    SELECT d.day,b.id,b.logged_in,b.per_day,d.is_workday,COALESCE(r.launches,0) launches
    FROM calendar_days d CROSS JOIN rv_base b LEFT JOIN rv_daily r ON r.email=b.email AND r.work_date=d.day
  ),
  rv_running AS MATERIALIZED (
    SELECT day,id,logged_in,per_day,
      sum(launches) OVER (PARTITION BY id ORDER BY day) launches_total,
      count(*) FILTER (WHERE is_workday) OVER (PARTITION BY id ORDER BY day) workdays_total
    FROM rv_grid
  ),
  rv_improved AS MATERIALIZED (
    SELECT day,logged_in,count(*) FILTER (WHERE launches_total::numeric/NULLIF(workdays_total,0)>per_day)::bigint cnt
    FROM rv_running GROUP BY day,logged_in
  ),
  all_workdays AS MATERIALIZED (
    SELECT d.day FROM days d WHERE EXISTS (SELECT 1 FROM public.calendar_workdays w WHERE w.date=d.day)
      OR (extract(isodow FROM d.day) BETWEEN 1 AND 5 AND NOT EXISTS (SELECT 1 FROM public.calendar_holidays h WHERE h.date=d.day))
  ),
  plugin_source AS MATERIALIZED (
    SELECT lower(user_email) email,work_date FROM public.elk_plugin_launches_baseline
    UNION ALL SELECT lower(user_email),work_date FROM public.elk_plugin_launches
  ),
  overview_days AS MATERIALIZED (
    SELECT d.day,(SELECT count(*) FROM logins l WHERE l.login_day<=d.day)::bigint logged_in,
      (SELECT sum(cnt) FROM ws_improved w WHERE w.day=d.day)::bigint improved_ws,
      (SELECT sum(cnt) FROM rv_improved r WHERE r.day=d.day)::bigint improved_revit,
      (SELECT cnt FROM ws_improved w WHERE w.day=d.day AND w.logged_in)::bigint improved_ws_logged,
      (SELECT cnt FROM rv_improved r WHERE r.day=d.day AND r.logged_in)::bigint improved_revit_logged,
      (SELECT cnt FROM ws_improved w WHERE w.day=d.day AND NOT w.logged_in)::bigint improved_ws_not_logged,
      (SELECT cnt FROM rv_improved r WHERE r.day=d.day AND NOT r.logged_in)::bigint improved_revit_not_logged
    FROM days d
  ),
  revit_chart AS MATERIALIZED (
    SELECT w.day,count(DISTINCT p.email)::bigint users FROM all_workdays w
    LEFT JOIN plugin_source p ON p.work_date=w.day AND p.email IN (SELECT email FROM cohort) GROUP BY w.day
  )
  SELECT jsonb_build_object(
    'coverage',jsonb_build_object(
      'company_total',(SELECT count(*) FROM public.ws_users WHERE is_active=true),
      'total_employees',(SELECT count(*) FROM cohort),'profiles_count',(SELECT count(*) FROM cohort WHERE logged_in),
      'earned_total',(SELECT COALESCE(sum(coins) FILTER (WHERE coins>0),0) FROM period_tx),
      'earned_logged',(SELECT COALESCE(sum(t.coins) FILTER (WHERE t.coins>0 AND c.logged_in),0) FROM period_tx t JOIN cohort c ON c.id=t.user_id),
      'earners',(SELECT count(DISTINCT user_id) FROM period_tx WHERE coins>0),
      'spent_total',(SELECT COALESCE(-sum(coins) FILTER (WHERE coins<0),0) FROM period_tx),
      'balance_at_to',(SELECT COALESCE(sum(bal.total_coins),0)-COALESCE((SELECT sum(t.coins) FROM public.gamification_transactions t JOIN cohort c2 ON c2.id=t.user_id CROSS JOIN bounds bo WHERE t.created_at>=bo.to_ts),0) FROM public.gamification_balances bal JOIN cohort c ON c.id=bal.user_id)
    ),
    'overview',jsonb_build_object(
      'total_cohort',(SELECT count(*) FROM cohort),
      'users_daily',COALESCE((SELECT jsonb_agg(jsonb_build_object('day',day,'logged_in',logged_in,'improved_ws',improved_ws,'improved_revit',improved_revit,'improved_ws_logged',improved_ws_logged,'improved_revit_logged',improved_revit_logged,'improved_ws_not_logged',improved_ws_not_logged,'improved_revit_not_logged',improved_revit_not_logged) ORDER BY day) FROM overview_days),'[]'::jsonb),
      'revit_daily',COALESCE((SELECT jsonb_agg(jsonb_build_object('day',day,'users',users) ORDER BY day) FROM revit_chart),'[]'::jsonb),
      'login_users',COALESCE((SELECT jsonb_agg(jsonb_build_object('department',department,'team',team,'user_name',trim(COALESCE(last_name,'')||' '||COALESCE(first_name,'')),'logged_in',logged_in) ORDER BY department,team,logged_in,last_name,first_name) FROM cohort),'[]'::jsonb)
    )
  ) INTO v_result;
  RETURN v_result;
END;
$fn$;
