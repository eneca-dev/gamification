-- Correct, period-aware and service-role-only data source for /admin/adoption.
-- Legacy adoption functions are intentionally left untouched.

CREATE INDEX IF NOT EXISTS idx_profiles_lower_email_created_at
  ON public.profiles (lower(email), created_at);
CREATE INDEX IF NOT EXISTS idx_gratitudes_sender_created_at
  ON public.gratitudes (sender_id, created_at);
CREATE INDEX IF NOT EXISTS idx_shop_orders_user_created_at
  ON public.shop_orders (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_streak_shield_log_user_created_at
  ON public.streak_shield_log (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created_at_role_user
  ON public.chat_messages (user_id, created_at) WHERE role = 'user';
CREATE INDEX IF NOT EXISTS idx_elk_plugin_launches_lower_email_work_date
  ON public.elk_plugin_launches (lower(user_email), work_date);
CREATE INDEX IF NOT EXISTS idx_elk_plugin_launches_baseline_lower_email_work_date
  ON public.elk_plugin_launches_baseline (lower(user_email), work_date);

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
    AND u.team IS DISTINCT FROM 'Декретный'
    AND EXISTS (
      SELECT 1 FROM public.admin_department_groups g
      WHERE g.department = u.department AND g.group_type = 'designer'
    );
$fn$;

CREATE OR REPLACE FUNCTION public.get_adoption_period_core_v2(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE v_result jsonb;
BEGIN
  IF p_to IS NULL OR (p_from IS NOT NULL AND p_from > p_to) THEN
    RAISE EXCEPTION 'Invalid adoption period';
  END IF;

  WITH
  bounds AS MATERIALIZED (
    SELECT
      CASE WHEN p_from IS NULL THEN NULL ELSE p_from::timestamp AT TIME ZONE 'Europe/Minsk' END AS from_ts,
      (p_to + 1)::timestamp AT TIME ZONE 'Europe/Minsk' AS to_ts,
      COALESCE(p_from, (
        SELECT LEAST(
          COALESCE((SELECT min((p.created_at AT TIME ZONE 'Europe/Minsk')::date) FROM public.profiles p), p_to),
          COALESCE((SELECT min(s.date) FROM public.ws_daily_statuses_baseline s), p_to),
          COALESCE((SELECT min(e.work_date) FROM public.elk_plugin_launches_baseline e), p_to)
        )
      )) AS effective_from
  ),
  cohort AS MATERIALIZED (
    SELECT c.*,
      EXISTS (
        SELECT 1 FROM public.profiles p, bounds b
        WHERE lower(p.email) = c.email AND p.created_at < b.to_ts
      ) AS logged_in
    FROM public.adoption_designer_cohort_v2() c
  ),
  period_tx AS MATERIALIZED (
    SELECT t.user_id, t.coins
    FROM public.gamification_transactions t
    JOIN cohort c ON c.id = t.user_id
    CROSS JOIN bounds b
    WHERE (b.from_ts IS NULL OR t.created_at >= b.from_ts) AND t.created_at < b.to_ts
  ),
  days AS MATERIALIZED (
    SELECT generate_series(b.effective_from, p_to, interval '1 day')::date AS day FROM bounds b
  ),
  logins AS MATERIALIZED (
    SELECT c.id, min((p.created_at AT TIME ZONE 'Europe/Minsk')::date) AS login_day
    FROM cohort c
    LEFT JOIN public.profiles p ON lower(p.email) = c.email
    GROUP BY c.id
  ),
  status_source AS MATERIALIZED (
    SELECT s.user_id, s.date, s.status FROM public.ws_daily_statuses_baseline s
    JOIN cohort c ON c.id = s.user_id
    UNION ALL
    SELECT s.user_id, s.date, s.status FROM public.ws_daily_statuses s
    JOIN cohort c ON c.id = s.user_id
  ),
  ws_base AS MATERIALIZED (
    SELECT c.id, c.logged_in,
      count(*) FILTER (WHERE s.status = 'green')::numeric /
        NULLIF(count(*) FILTER (WHERE s.status IN ('green','red')), 0) AS ratio
    FROM cohort c
    LEFT JOIN status_source s ON s.user_id = c.id AND s.date BETWEEN DATE '2026-06-29' AND DATE '2026-06-30'
    GROUP BY c.id, c.logged_in
  ),
  improvement_days AS MATERIALIZED (
    SELECT d.day FROM days d WHERE d.day >= DATE '2026-07-01'
  ),
  ws_improved AS MATERIALIZED (
    SELECT d.day, b.logged_in, count(*) FILTER (WHERE x.ratio > b.ratio)::bigint AS cnt
    FROM improvement_days d CROSS JOIN ws_base b
    LEFT JOIN LATERAL (
      SELECT count(*) FILTER (WHERE s.status='green')::numeric /
        NULLIF(count(*) FILTER (WHERE s.status IN ('green','red')), 0) AS ratio
      FROM status_source s
      WHERE s.user_id=b.id AND s.date BETWEEN DATE '2026-07-01' AND d.day
    ) x ON true
    WHERE b.ratio IS NOT NULL
    GROUP BY d.day, b.logged_in
  ),
  workdays AS MATERIALIZED (
    SELECT d.day
    FROM days d
    WHERE d.day >= DATE '2026-07-01' AND (
      EXISTS (SELECT 1 FROM public.calendar_workdays w WHERE w.date=d.day)
      OR (extract(isodow FROM d.day) BETWEEN 1 AND 5
          AND NOT EXISTS (SELECT 1 FROM public.calendar_holidays h WHERE h.date=d.day))
    )
  ),
  rv_base AS MATERIALIZED (
    SELECT c.id, c.email, c.logged_in,
      COALESCE(sum(e.launch_count),0)::numeric / 2 AS per_day
    FROM cohort c
    LEFT JOIN public.elk_plugin_launches_baseline e
      ON lower(e.user_email)=c.email AND e.work_date BETWEEN DATE '2026-06-29' AND DATE '2026-06-30'
    GROUP BY c.id, c.email, c.logged_in
  ),
  rv_improved AS MATERIALIZED (
    SELECT d.day, b.logged_in, count(*) FILTER (
      WHERE COALESCE(x.launches,0)::numeric / NULLIF((SELECT count(*) FROM workdays w WHERE w.day<=d.day),0) > b.per_day
    )::bigint AS cnt
    FROM improvement_days d CROSS JOIN rv_base b
    LEFT JOIN LATERAL (
      SELECT sum(e.launch_count) AS launches FROM public.elk_plugin_launches e
      WHERE lower(e.user_email)=b.email AND e.work_date BETWEEN DATE '2026-07-01' AND d.day
    ) x ON true
    GROUP BY d.day, b.logged_in
  ),
  plugin_source AS MATERIALIZED (
    SELECT lower(e.user_email) AS email, e.work_date FROM public.elk_plugin_launches_baseline e
    UNION ALL
    SELECT lower(e.user_email), e.work_date FROM public.elk_plugin_launches e
  ),
  overview_days AS MATERIALIZED (
    SELECT d.day,
      (SELECT count(*) FROM logins l WHERE l.login_day <= d.day)::bigint AS logged_in,
      (SELECT sum(w.cnt) FROM ws_improved w WHERE w.day=d.day)::bigint AS improved_ws,
      (SELECT sum(r.cnt) FROM rv_improved r WHERE r.day=d.day)::bigint AS improved_revit,
      (SELECT w.cnt FROM ws_improved w WHERE w.day=d.day AND w.logged_in)::bigint AS improved_ws_logged,
      (SELECT r.cnt FROM rv_improved r WHERE r.day=d.day AND r.logged_in)::bigint AS improved_revit_logged,
      (SELECT w.cnt FROM ws_improved w WHERE w.day=d.day AND NOT w.logged_in)::bigint AS improved_ws_not_logged,
      (SELECT r.cnt FROM rv_improved r WHERE r.day=d.day AND NOT r.logged_in)::bigint AS improved_revit_not_logged
    FROM days d
  ),
  revit_daily AS MATERIALIZED (
    SELECT w.day, count(DISTINCT p.email)::bigint AS users
    FROM workdays w
    LEFT JOIN plugin_source p ON p.work_date=w.day AND p.email IN (SELECT email FROM cohort)
    GROUP BY w.day
  )
  SELECT jsonb_build_object(
    'coverage', jsonb_build_object(
      'company_total', (SELECT count(*) FROM public.ws_users u WHERE u.is_active=true),
      'total_employees', (SELECT count(*) FROM cohort),
      'profiles_count', (SELECT count(*) FROM cohort WHERE logged_in),
      'earned_total', (SELECT COALESCE(sum(coins) FILTER (WHERE coins>0),0) FROM period_tx),
      'earned_logged', (SELECT COALESCE(sum(t.coins) FILTER (WHERE t.coins>0 AND c.logged_in),0) FROM period_tx t JOIN cohort c ON c.id=t.user_id),
      'earners', (SELECT count(DISTINCT user_id) FROM period_tx WHERE coins>0),
      'spent_total', (SELECT COALESCE(-sum(coins) FILTER (WHERE coins<0),0) FROM period_tx),
      'balance_at_to', (
        SELECT COALESCE(sum(bal.total_coins),0) - COALESCE((
          SELECT sum(t.coins) FROM public.gamification_transactions t
          JOIN cohort c2 ON c2.id=t.user_id CROSS JOIN bounds bo WHERE t.created_at>=bo.to_ts
        ),0)
        FROM public.gamification_balances bal JOIN cohort c ON c.id=bal.user_id
      )
    ),
    'overview', jsonb_build_object(
      'total_cohort', (SELECT count(*) FROM cohort),
      'users_daily', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'day', day, 'logged_in', logged_in,
        'improved_ws', improved_ws, 'improved_revit', improved_revit,
        'improved_ws_logged', improved_ws_logged, 'improved_revit_logged', improved_revit_logged,
        'improved_ws_not_logged', improved_ws_not_logged, 'improved_revit_not_logged', improved_revit_not_logged
      ) ORDER BY day) FROM overview_days), '[]'::jsonb),
      'revit_daily', COALESCE((SELECT jsonb_agg(jsonb_build_object('day',day,'users',users) ORDER BY day) FROM revit_daily), '[]'::jsonb),
      'login_users', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'department', c.department, 'team', c.team,
        'user_name', trim(COALESCE(c.last_name,'') || ' ' || COALESCE(c.first_name,'')),
        'logged_in', c.logged_in
      ) ORDER BY c.department, c.team, c.logged_in, c.last_name, c.first_name) FROM cohort c), '[]'::jsonb)
    )
  ) INTO v_result;
  RETURN v_result;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.get_adoption_period_worksection_v2(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE v_result jsonb;
BEGIN
  IF p_to IS NULL OR (p_from IS NOT NULL AND p_from > p_to) THEN RAISE EXCEPTION 'Invalid adoption period'; END IF;
  WITH
  cohort AS MATERIALIZED (
    SELECT c.*, EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE lower(p.email)=c.email AND p.created_at < ((p_to+1)::timestamp AT TIME ZONE 'Europe/Minsk')
    ) AS logged_in
    FROM public.adoption_designer_cohort_v2() c
  ),
  src AS MATERIALIZED (
    SELECT s.user_id,s.date,s.status,s.red_reasons FROM public.ws_daily_statuses_baseline s JOIN cohort c ON c.id=s.user_id
    WHERE (p_from IS NULL OR s.date>=p_from) AND s.date<=p_to
    UNION ALL
    SELECT s.user_id,s.date,s.status,s.red_reasons FROM public.ws_daily_statuses s JOIN cohort c ON c.id=s.user_id
    WHERE (p_from IS NULL OR s.date>=p_from) AND s.date<=p_to
  ),
  daily AS MATERIALIZED (
    SELECT date AS day,
      count(*) FILTER (WHERE status IN ('green','red'))::bigint AS tracked,
      count(*) FILTER (WHERE status='green')::bigint AS green,
      count(*) FILTER (WHERE status='red' AND red_reasons @> '[{"type":"wrong_status_report"}]')::bigint AS wrong_count,
      count(*) FILTER (WHERE status='red' AND red_reasons @> '[{"type":"red_day"}]')::bigint AS no_report_count
    FROM src GROUP BY date
    HAVING count(*) FILTER (WHERE status IN ('green','red'))>0
  ),
  effect AS MATERIALIZED (
    SELECT c.logged_in,
      count(DISTINCT s.user_id)::bigint AS users,
      round(100.0*count(*) FILTER (WHERE s.status='green')/NULLIF(count(*) FILTER (WHERE s.status IN ('green','red')),0),1) AS period_pct,
      round(100.0*count(*) FILTER (WHERE s.status='green' AND s.date<DATE '2026-07-01')/NULLIF(count(*) FILTER (WHERE s.status IN ('green','red') AND s.date<DATE '2026-07-01'),0),1) AS before_pct,
      round(100.0*count(*) FILTER (WHERE s.status='green' AND s.date>=DATE '2026-07-01')/NULLIF(count(*) FILTER (WHERE s.status IN ('green','red') AND s.date>=DATE '2026-07-01'),0),1) AS after_pct
    FROM src s JOIN cohort c ON c.id=s.user_id GROUP BY c.logged_in
  ),
  red_users AS MATERIALIZED (
    SELECT reason->>'type' AS reason_type,
      trim(COALESCE(c.last_name,'') || ' ' || COALESCE(c.first_name,'')) AS name,
      c.department, count(DISTINCT s.date)::bigint AS days
    FROM src s JOIN cohort c ON c.id=s.user_id
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.red_reasons,'[]'::jsonb)) reason
    WHERE s.status='red' AND reason->>'type' IN ('red_day','wrong_status_report')
    GROUP BY reason->>'type',c.id,c.last_name,c.first_name,c.department
  ),
  totals AS (
    SELECT
      count(*) FILTER (WHERE day<DATE '2026-07-01') AS before_days,
      count(*) FILTER (WHERE day>=DATE '2026-07-01') AS after_days,
      sum(tracked) AS tracked, sum(green) AS green, sum(wrong_count) AS wrong_count, sum(no_report_count) AS no_report_count,
      sum(tracked) FILTER (WHERE day<DATE '2026-07-01') AS tracked_before,
      sum(green) FILTER (WHERE day<DATE '2026-07-01') AS green_before,
      sum(wrong_count) FILTER (WHERE day<DATE '2026-07-01') AS wrong_before,
      sum(no_report_count) FILTER (WHERE day<DATE '2026-07-01') AS no_report_before,
      sum(tracked) FILTER (WHERE day>=DATE '2026-07-01') AS tracked_after,
      sum(green) FILTER (WHERE day>=DATE '2026-07-01') AS green_after,
      sum(wrong_count) FILTER (WHERE day>=DATE '2026-07-01') AS wrong_after,
      sum(no_report_count) FILTER (WHERE day>=DATE '2026-07-01') AS no_report_after
    FROM daily
  )
  SELECT jsonb_build_object(
    'comparison_mode', CASE WHEN before_days>0 AND after_days>0 THEN 'launch' ELSE 'period' END,
    'period_from', p_from, 'period_to', p_to,
    'green_period', COALESCE(round(100.0*green/NULLIF(tracked,0)),0),
    'wrong_task_period', COALESCE(round(1000.0*wrong_count/NULLIF(tracked,0))/10,0),
    'no_report_period', COALESCE(round(1000.0*no_report_count/NULLIF(tracked,0))/10,0),
    'wrong_task_day_period', COALESCE(round(10.0*wrong_count/NULLIF(before_days+after_days,0))/10,0),
    'no_report_day_period', COALESCE(round(10.0*no_report_count/NULLIF(before_days+after_days,0))/10,0),
    'green_before', COALESCE(round(100.0*green_before/NULLIF(tracked_before,0)),0),
    'green_after', COALESCE(round(100.0*green_after/NULLIF(tracked_after,0)),0),
    'wrong_task_before', COALESCE(round(1000.0*wrong_before/NULLIF(tracked_before,0))/10,0),
    'wrong_task_after', COALESCE(round(1000.0*wrong_after/NULLIF(tracked_after,0))/10,0),
    'no_report_before', COALESCE(round(1000.0*no_report_before/NULLIF(tracked_before,0))/10,0),
    'no_report_after', COALESCE(round(1000.0*no_report_after/NULLIF(tracked_after,0))/10,0),
    'wrong_task_day_before', COALESCE(round(10.0*wrong_before/NULLIF(before_days,0))/10,0),
    'wrong_task_day_after', COALESCE(round(10.0*wrong_after/NULLIF(after_days,0))/10,0),
    'no_report_day_before', COALESCE(round(10.0*no_report_before/NULLIF(before_days,0))/10,0),
    'no_report_day_after', COALESCE(round(10.0*no_report_after/NULLIF(after_days,0))/10,0),
    'daily', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'day',day,'green_pct',round(1000.0*green/NULLIF(tracked,0))/10,
      'wrong_task_pct',round(1000.0*wrong_count/NULLIF(tracked,0))/10,
      'no_report_pct',round(1000.0*no_report_count/NULLIF(tracked,0))/10
    ) ORDER BY day) FROM daily),'[]'::jsonb),
    'no_report_users', COALESCE((SELECT jsonb_agg(jsonb_build_object('name',name,'department',department,'days',days) ORDER BY days DESC,name) FROM red_users WHERE reason_type='red_day'),'[]'::jsonb),
    'wrong_task_users', COALESCE((SELECT jsonb_agg(jsonb_build_object('name',name,'department',department,'days',days) ORDER BY days DESC,name) FROM red_users WHERE reason_type='wrong_status_report'),'[]'::jsonb),
    'logged', COALESCE((SELECT jsonb_build_object('users',users,'green_period',COALESCE(period_pct,0),'green_before',COALESCE(before_pct,0),'green_after',COALESCE(after_pct,0)) FROM effect WHERE logged_in), jsonb_build_object('users',0,'green_period',0,'green_before',0,'green_after',0)),
    'not_logged', COALESCE((SELECT jsonb_build_object('users',users,'green_period',COALESCE(period_pct,0),'green_before',COALESCE(before_pct,0),'green_after',COALESCE(after_pct,0)) FROM effect WHERE NOT logged_in), jsonb_build_object('users',0,'green_period',0,'green_before',0,'green_after',0))
  ) INTO v_result FROM totals;
  RETURN v_result;
END;
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
  period_days AS MATERIALIZED (SELECT day FROM workdays,bounds WHERE day BETWEEN effective_from AND p_to),
  base_users AS MATERIALIZED (SELECT DISTINCT email FROM src WHERE work_date BETWEEN DATE '2026-06-01' AND DATE '2026-06-30'),
  period_users AS MATERIALIZED (SELECT DISTINCT s.email FROM src s,bounds b WHERE s.work_date BETWEEN GREATEST(b.effective_from,DATE '2026-07-01') AND p_to),
  week_users AS MATERIALIZED (
    SELECT date_trunc('week',p.day)::date AS week,count(DISTINCT s.email)::bigint AS users
    FROM period_days p LEFT JOIN src s ON s.work_date=p.day GROUP BY 1
  )
  SELECT jsonb_build_object(
    'period_from',p_from,'period_to',p_to,'total_cohort',(SELECT count(*) FROM cohort),
    'daily_active_before',COALESCE((SELECT round(sum(d.users)::numeric/NULLIF(count(*),0)) FROM daily d JOIN base_days b ON b.day=d.day),0),
    'daily_active_after',COALESCE((SELECT round(sum(d.users)::numeric/NULLIF(count(*),0)) FROM daily d JOIN period_days p ON p.day=d.day),0),
    'launches_day_before',COALESCE((SELECT round(sum(d.launches)::numeric/NULLIF(count(*),0)) FROM daily d JOIN base_days b ON b.day=d.day),0),
    'launches_day_after',COALESCE((SELECT round(sum(d.launches)::numeric/NULLIF(count(*),0)) FROM daily d JOIN period_days p ON p.day=d.day),0),
    'new_users_after',(SELECT count(*) FROM period_users p WHERE NOT EXISTS (SELECT 1 FROM base_users b WHERE b.email=p.email)),
    'weekly_audience',COALESCE((SELECT round(avg(users)) FROM week_users),0),
    'daily',COALESCE((SELECT jsonb_agg(jsonb_build_object('day',d.day,'users',d.users,'launches',d.launches) ORDER BY d.day) FROM daily d JOIN period_days p ON p.day=d.day),'[]'::jsonb),
    'effect_logged',jsonb_build_object(
      'users',(SELECT count(*) FROM cohort WHERE logged_in),
      'active_before',COALESCE((SELECT round(1000.0*count(DISTINCT (s.email,s.work_date))/NULLIF((SELECT count(*) FROM base_days)*(SELECT count(*) FROM cohort WHERE logged_in),0))/10 FROM src s JOIN cohort c ON c.email=s.email AND c.logged_in WHERE s.work_date BETWEEN DATE '2026-06-01' AND DATE '2026-06-30'),0),
      'active_after',COALESCE((SELECT round(1000.0*count(DISTINCT (s.email,s.work_date))/NULLIF((SELECT count(*) FROM period_days)*(SELECT count(*) FROM cohort WHERE logged_in),0))/10 FROM src s JOIN cohort c ON c.email=s.email AND c.logged_in JOIN bounds b ON true WHERE s.work_date BETWEEN b.effective_from AND p_to),0)
    ),
    'effect_not_logged',jsonb_build_object(
      'users',(SELECT count(*) FROM cohort WHERE NOT logged_in),
      'active_before',COALESCE((SELECT round(1000.0*count(DISTINCT (s.email,s.work_date))/NULLIF((SELECT count(*) FROM base_days)*(SELECT count(*) FROM cohort WHERE NOT logged_in),0))/10 FROM src s JOIN cohort c ON c.email=s.email AND NOT c.logged_in WHERE s.work_date BETWEEN DATE '2026-06-01' AND DATE '2026-06-30'),0),
      'active_after',COALESCE((SELECT round(1000.0*count(DISTINCT (s.email,s.work_date))/NULLIF((SELECT count(*) FROM period_days)*(SELECT count(*) FROM cohort WHERE NOT logged_in),0))/10 FROM src s JOIN cohort c ON c.email=s.email AND NOT c.logged_in JOIN bounds b ON true WHERE s.work_date BETWEEN b.effective_from AND p_to),0)
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
  bounds AS MATERIALIZED (SELECT CASE WHEN p_from IS NULL THEN NULL ELSE p_from::timestamp AT TIME ZONE 'Europe/Minsk' END from_ts,(p_to+1)::timestamp AT TIME ZONE 'Europe/Minsk' to_ts),
  cohort AS MATERIALIZED (SELECT * FROM public.adoption_designer_cohort_v2()),
  profiles_at_to AS MATERIALIZED (SELECT p.user_id,lower(p.email) email FROM public.profiles p,bounds b WHERE p.created_at<b.to_ts),
  grats AS MATERIALIZED (SELECT g.sender_id,g.recipient_id FROM public.gratitudes g JOIN cohort c ON c.id=g.sender_id CROSS JOIN bounds b WHERE (b.from_ts IS NULL OR g.created_at>=b.from_ts) AND g.created_at<b.to_ts),
  orders AS MATERIALIZED (SELECT o.user_id FROM public.shop_orders o JOIN cohort c ON c.id=o.user_id JOIN public.shop_products p ON p.id=o.product_id CROSS JOIN bounds b WHERE o.status<>'cancelled' AND p.effect IS NULL AND (b.from_ts IS NULL OR o.created_at>=b.from_ts) AND o.created_at<b.to_ts),
  shields AS MATERIALIZED (SELECT s.user_id FROM public.streak_shield_log s JOIN cohort c ON c.id=s.user_id CROSS JOIN bounds b WHERE (b.from_ts IS NULL OR s.created_at>=b.from_ts) AND s.created_at<b.to_ts),
  chats AS MATERIALIZED (SELECT m.user_id FROM public.chat_messages m JOIN profiles_at_to p ON p.user_id=m.user_id JOIN cohort c ON c.email=p.email CROSS JOIN bounds b WHERE m.role='user' AND (b.from_ts IS NULL OR m.created_at>=b.from_ts) AND m.created_at<b.to_ts),
  days AS MATERIALIZED (SELECT generate_series(DATE '2026-07-01',p_to,interval '1 day')::date AS day WHERE p_to>=DATE '2026-07-01'),
  ws_src AS MATERIALIZED (SELECT s.user_id,s.date,s.status FROM public.ws_daily_statuses s JOIN cohort c ON c.id=s.user_id WHERE s.date BETWEEN DATE '2026-07-01' AND p_to),
  ws_last_fail AS MATERIALIZED (SELECT c.id,max(s.date) FILTER (WHERE s.status='red' AND NOT EXISTS (SELECT 1 FROM public.streak_shield_log l WHERE l.user_id=c.id AND l.protected_date=s.date AND l.shield_type='ws')) fail FROM cohort c LEFT JOIN ws_src s ON s.user_id=c.id GROUP BY c.id),
  ws_streak AS MATERIALIZED (SELECT f.id,count(*) FILTER (WHERE s.status='green' OR (s.status='red' AND EXISTS (SELECT 1 FROM public.streak_shield_log l WHERE l.user_id=f.id AND l.protected_date=s.date AND l.shield_type='ws')))::bigint streak FROM ws_last_fail f LEFT JOIN ws_src s ON s.user_id=f.id AND s.date>COALESCE(f.fail,DATE '2026-06-30') GROUP BY f.id),
  rv_workdays AS MATERIALIZED (SELECT d.day FROM days d WHERE EXISTS (SELECT 1 FROM public.calendar_workdays w WHERE w.date=d.day) OR (extract(isodow FROM d.day) BETWEEN 1 AND 5 AND NOT EXISTS (SELECT 1 FROM public.calendar_holidays h WHERE h.date=d.day))),
  rv_eval AS MATERIALIZED (SELECT c.id,d.day,
    EXISTS (SELECT 1 FROM public.ws_user_absences a WHERE lower(a.user_email)=c.email AND a.absence_date=d.day) absent,
    EXISTS (SELECT 1 FROM public.elk_plugin_launches e WHERE lower(e.user_email)=c.email AND e.work_date=d.day) launched,
    EXISTS (SELECT 1 FROM public.streak_shield_log l WHERE l.user_id=c.id AND l.protected_date=d.day AND l.shield_type='revit') shielded
    FROM cohort c CROSS JOIN rv_workdays d),
  rv_last_fail AS MATERIALIZED (SELECT id,max(day) FILTER (WHERE NOT absent AND NOT launched AND NOT shielded) fail FROM rv_eval GROUP BY id),
  rv_streak AS MATERIALIZED (SELECT f.id,count(*) FILTER (WHERE e.day>COALESCE(f.fail,DATE '2026-06-30') AND NOT e.absent AND (e.launched OR e.shielded))::bigint streak FROM rv_last_fail f JOIN rv_eval e ON e.id=f.id GROUP BY f.id)
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
    WHERE u.is_active=true AND u.team IS DISTINCT FROM 'Декретный' AND (
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

REVOKE ALL ON FUNCTION public.adoption_designer_cohort_v2() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_adoption_period_core_v2(date,date) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_adoption_period_worksection_v2(date,date) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_adoption_period_plugins_v2(date,date) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_adoption_period_engagement_v2(date,date) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_adoption_monthly_summary_v3(date,date,text,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.adoption_designer_cohort_v2() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_adoption_period_core_v2(date,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_adoption_period_worksection_v2(date,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_adoption_period_plugins_v2(date,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_adoption_period_engagement_v2(date,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_adoption_monthly_summary_v3(date,date,text,text[]) TO service_role;
