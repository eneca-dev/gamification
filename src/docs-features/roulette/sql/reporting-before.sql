-- Metadata snapshot 2026-11-17. Reference only.
CREATE OR REPLACE FUNCTION public.get_adoption_monthly_summary_v3(p_from date, p_to date, p_scope text DEFAULT 'designer'::text, p_departments text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE v_result jsonb;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from>p_to THEN RAISE EXCEPTION 'Invalid monthly report period'; END IF;
  IF p_scope NOT IN ('designer','all','selected') THEN RAISE EXCEPTION 'Invalid cohort scope'; END IF;
  WITH
  bounds AS MATERIALIZED (
    SELECT p_from::timestamp AT TIME ZONE 'Europe/Minsk' from_ts,
      (p_to+1)::timestamp AT TIME ZONE 'Europe/Minsk' to_ts
  ),
  cohort AS MATERIALIZED (
    SELECT u.id,lower(u.email) email FROM public.ws_users u
    WHERE u.is_active=true AND (
      p_scope='all'
      OR (p_scope='designer' AND EXISTS (
        SELECT 1 FROM public.admin_department_groups g
        WHERE g.department=u.department AND g.group_type='designer'
      ))
      OR (p_scope='selected' AND u.department=ANY(COALESCE(p_departments,ARRAY[]::text[])))
    )
  ),
  actions AS MATERIALIZED (
    SELECT g.sender_id user_id,'gratitude' action
    FROM public.gratitudes g JOIN cohort c ON c.id=g.sender_id CROSS JOIN bounds b
    WHERE g.created_at>=b.from_ts AND g.created_at<b.to_ts
    UNION ALL
    SELECT o.user_id,'shop'
    FROM public.shop_orders o JOIN cohort c ON c.id=o.user_id
    JOIN public.shop_products p ON p.id=o.product_id CROSS JOIN bounds b
    WHERE o.status<>'cancelled' AND p.effect IS NULL
      AND o.created_at>=b.from_ts AND o.created_at<b.to_ts
    UNION ALL
    SELECT s.user_id,'shield'
    FROM public.streak_shield_log s JOIN cohort c ON c.id=s.user_id CROSS JOIN bounds b
    WHERE s.created_at>=b.from_ts AND s.created_at<b.to_ts
  ),
  shield_opportunities AS MATERIALIZED (
    SELECT DISTINCT s.user_id,s.protected_date opportunity_date,s.shield_type source,true saved
    FROM public.streak_shield_log s JOIN cohort c ON c.id=s.user_id
    WHERE s.protected_date BETWEEN p_from AND p_to
  ),
  reset_opportunities AS MATERIALIZED (
    SELECT DISTINCT e.user_id,e.event_date opportunity_date,
      CASE WHEN e.event_type='revit_streak_reset' THEN 'revit' ELSE 'ws' END source,
      false saved
    FROM public.gamification_event_logs e JOIN cohort c ON c.id=e.user_id
    WHERE e.event_date BETWEEN p_from AND p_to
      AND (e.event_type='revit_streak_reset' OR e.event_type LIKE 'streak_reset_%')
  ),
  streak_opportunity_outcomes AS MATERIALIZED (
    SELECT o.user_id,o.opportunity_date,o.source,bool_or(o.saved) saved
    FROM (
      SELECT * FROM shield_opportunities
      UNION ALL
      SELECT * FROM reset_opportunities
    ) o
    GROUP BY o.user_id,o.opportunity_date,o.source
  ),
  statuses AS MATERIALIZED (
    SELECT s.user_id,s.status,s.red_reasons
    FROM public.ws_daily_statuses s JOIN cohort c ON c.id=s.user_id
    WHERE s.date BETWEEN p_from AND p_to
    UNION ALL
    SELECT s.user_id,s.status,s.red_reasons
    FROM public.ws_daily_statuses_baseline s JOIN cohort c ON c.id=s.user_id
    WHERE s.date BETWEEN p_from AND p_to
  ),
  tx AS MATERIALIZED (
    SELECT t.user_id,t.coins
    FROM public.gamification_transactions t JOIN cohort c ON c.id=t.user_id CROSS JOIN bounds b
    WHERE t.created_at>=b.from_ts AND t.created_at<b.to_ts
  )
  SELECT jsonb_build_object(
    'cohort_count',(SELECT count(*) FROM cohort),
    'registered_count',(SELECT count(*) FROM cohort c,bounds b WHERE EXISTS (
      SELECT 1 FROM public.profiles p WHERE lower(p.email)=c.email AND p.created_at<b.to_ts
    )),
    'gamification_active_count',(SELECT count(DISTINCT user_id) FROM actions),
    'gratitude_senders',(SELECT count(DISTINCT user_id) FROM actions WHERE action='gratitude'),
    'shop_buyers',(SELECT count(DISTINCT user_id) FROM actions WHERE action='shop'),
    'shield_users',(SELECT count(DISTINCT user_id) FROM actions WHERE action='shield'),
    'shield_response_users',(SELECT count(DISTINCT user_id) FROM streak_opportunity_outcomes WHERE saved),
    'shield_opportunity_users',(SELECT count(DISTINCT user_id) FROM streak_opportunity_outcomes),
    'shield_saved_opportunities',(SELECT count(*) FROM streak_opportunity_outcomes WHERE saved),
    'shield_total_opportunities',(SELECT count(*) FROM streak_opportunity_outcomes),
    'earned_coins',(SELECT COALESCE(sum(coins) FILTER (WHERE coins>0),0) FROM tx),
    'spent_coins',(SELECT COALESCE(-sum(coins) FILTER (WHERE coins<0),0) FROM tx),
    'green_pct',(SELECT round(100.0*count(*) FILTER (WHERE status='green')/NULLIF(count(*) FILTER (WHERE status IN ('green','red')),0),1) FROM statuses),
    'wrong_status_pct',(SELECT round(100.0*count(*) FILTER (WHERE status='red' AND red_reasons @> '[{"type":"wrong_status_report"}]')/NULLIF(count(*) FILTER (WHERE status IN ('green','red')),0),1) FROM statuses),
    'no_report_pct',(SELECT round(100.0*count(*) FILTER (WHERE status='red' AND red_reasons @> '[{"type":"red_day"}]')/NULLIF(count(*) FILTER (WHERE status IN ('green','red')),0),1) FROM statuses)
  ) INTO v_result;
  RETURN v_result;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_adoption_period_core_v2(p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.get_economy_overview(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH
  earned AS (
    SELECT COALESCE(SUM(t.coins), 0)::bigint AS total
    FROM gamification_transactions t
    JOIN ws_users u ON u.id = t.user_id
    WHERE t.coins > 0
      AND (p_from IS NULL OR t.created_at >= p_from)
      AND (p_to IS NULL OR t.created_at < p_to)
  ),
  revoked AS (
    SELECT
      COALESCE(SUM(ABS(t.coins)), 0)::bigint AS actual,
      COALESCE(SUM(GREATEST(ABS(et.coins) - ABS(t.coins), 0)), 0)::bigint AS gifted,
      COUNT(*) FILTER (WHERE ABS(t.coins) < ABS(et.coins))::bigint AS clamped_count,
      COUNT(*)::bigint AS total_count
    FROM gamification_transactions t
    JOIN gamification_event_logs el ON el.id = t.event_id
    JOIN gamification_event_types et ON et.key = el.event_type
    JOIN ws_users u ON u.id = t.user_id
    LEFT JOIN ws_tasks_l3 t3 ON t3.ws_task_id = COALESCE(
      el.details->>'ws_task_id',
      el.details->'exceeded_task'->>'id',
      el.details->'original_details'->>'ws_task_id'
    )
    LEFT JOIN ws_tasks_l2 t2 ON t2.ws_task_id = COALESCE(
      el.details->>'ws_task_id',
      el.details->'exceeded_task'->>'id',
      el.details->'original_details'->>'ws_task_id'
    )
    WHERE el.event_type LIKE '%revoked%'
      AND et.coins < 0
      AND t.coins <= 0
      AND COALESCE(
        t3.date_closed::date,
        t2.date_closed::date,
        (el.details->'original_details'->>'date_closed')::date,
        el.event_date
      ) >= '2026-03-25'::date
      AND (p_from IS NULL OR t.created_at >= p_from)
      AND (p_to IS NULL OR t.created_at < p_to)
  ),
  shop AS (
    SELECT
      COALESCE(SUM(ABS(t.coins)), 0)::bigint AS coins,
      COUNT(DISTINCT o.user_id)::bigint AS users
    FROM shop_orders o
    JOIN gamification_transactions t ON t.id = o.transaction_id
    JOIN shop_products p ON p.id = o.product_id
    JOIN shop_categories c ON c.id = p.category_id
    JOIN ws_users u ON u.id = o.user_id
    WHERE o.status <> 'cancelled'
      AND c.slug <> 'draw'
      AND p.effect IS NULL
      AND (p_from IS NULL OR o.created_at >= p_from)
      AND (p_to IS NULL OR o.created_at < p_to)
  ),
  lottery AS (
    SELECT
      COALESCE(SUM(ABS(t.coins)), 0)::bigint AS coins,
      COUNT(DISTINCT o.user_id)::bigint AS users
    FROM shop_orders o
    JOIN gamification_transactions t ON t.id = o.transaction_id
    JOIN shop_products p ON p.id = o.product_id
    JOIN shop_categories c ON c.id = p.category_id
    JOIN ws_users u ON u.id = o.user_id
    WHERE o.status <> 'cancelled'
      AND c.slug = 'draw'
      AND (p_from IS NULL OR o.created_at >= p_from)
      AND (p_to IS NULL OR o.created_at < p_to)
  ),
  second_life AS (
    SELECT
      COALESCE(SUM(ABS(t.coins)), 0)::bigint AS coins,
      COUNT(DISTINCT o.user_id)::bigint AS users
    FROM shop_orders o
    JOIN gamification_transactions t ON t.id = o.transaction_id
    JOIN shop_products p ON p.id = o.product_id
    JOIN ws_users u ON u.id = o.user_id
    WHERE o.status <> 'cancelled'
      AND p.effect IN ('streak_shield_ws','streak_shield_revit')
      AND (p_from IS NULL OR o.created_at >= p_from)
      AND (p_to IS NULL OR o.created_at < p_to)
  ),
  paid_gratitudes AS (
    SELECT
      COALESCE(SUM(g.coins_amount), 0)::bigint AS coins,
      COUNT(DISTINCT g.sender_id)::bigint AS users
    FROM gratitudes g
    JOIN ws_users u ON u.id = g.sender_id
    WHERE g.gift_source = 'balance'
      AND (p_from IS NULL OR g.created_at >= p_from)
      AND (p_to IS NULL OR g.created_at < p_to)
  ),
  quota_gratitudes AS (
    SELECT
      COALESCE(SUM(t.coins), 0)::bigint AS coins,
      COUNT(DISTINCT g.sender_id)::bigint AS users
    FROM gratitudes g
    JOIN gamification_event_logs el ON (el.details->>'gratitude_id')::uuid = g.id
    JOIN gamification_transactions t ON t.event_id = el.id
    JOIN ws_users u ON u.id = g.sender_id
    WHERE g.gift_source = 'quota'
      AND el.event_type = 'gratitude_recipient_points'
      AND (p_from IS NULL OR g.created_at >= p_from)
      AND (p_to IS NULL OR g.created_at < p_to)
  )
  SELECT jsonb_build_object(
    'earned', earned.total,
    'revoked_actual', revoked.actual,
    'factually_earned', earned.total - revoked.actual,
    'gifted_by_company', revoked.gifted,
    'clamped_count', revoked.clamped_count,
    'total_revoked_count', revoked.total_count,
    'channels', jsonb_build_object(
      'shop', jsonb_build_object('coins', shop.coins, 'users', shop.users),
      'lottery', jsonb_build_object('coins', lottery.coins, 'users', lottery.users),
      'second_life', jsonb_build_object('coins', second_life.coins, 'users', second_life.users),
      'paid_gratitudes', jsonb_build_object('coins', paid_gratitudes.coins, 'users', paid_gratitudes.users),
      'quota_gratitudes', jsonb_build_object('coins', quota_gratitudes.coins, 'users', quota_gratitudes.users)
    )
  )
  FROM earned, revoked, shop, lottery, second_life, paid_gratitudes, quota_gratitudes;
$function$
;
CREATE OR REPLACE FUNCTION public.get_economy_top(p_from timestamp with time zone, p_to timestamp with time zone, p_source text, p_level text)
 RETURNS TABLE(id text, name text, value bigint, secondary bigint)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_level NOT IN ('user', 'team', 'department') THEN
    RAISE EXCEPTION 'Unknown level: %', p_level;
  END IF;

  IF p_source = 'earned' THEN
    RETURN QUERY
    WITH base AS (
      SELECT u.id AS user_id, u.first_name, u.last_name, u.team, u.department, t.coins
      FROM gamification_transactions t
      JOIN ws_users u ON u.id = t.user_id
      WHERE t.coins > 0
        AND (p_from IS NULL OR t.created_at >= p_from)
        AND (p_to IS NULL OR t.created_at < p_to)
    )
    SELECT
      CASE p_level
        WHEN 'user' THEN b.user_id::text
        WHEN 'team' THEN COALESCE(b.team, '__no_team__')
        WHEN 'department' THEN COALESCE(b.department, '__no_dept__')
      END,
      CASE p_level
        WHEN 'user' THEN NULLIF(TRIM(COALESCE(b.first_name, '') || ' ' || COALESCE(b.last_name, '')), '')
        WHEN 'team' THEN COALESCE(b.team, 'Без команды')
        WHEN 'department' THEN COALESCE(b.department, 'Без отдела')
      END,
      SUM(b.coins)::bigint,
      NULL::bigint
    FROM base b
    GROUP BY 1, 2
    ORDER BY 3 DESC NULLS LAST;

  ELSIF p_source = 'revoked' THEN
    RETURN QUERY
    WITH base AS (
      SELECT u.id AS user_id, u.first_name, u.last_name, u.team, u.department, t.coins
      FROM gamification_transactions t
      JOIN gamification_event_logs el ON el.id = t.event_id
      JOIN ws_users u ON u.id = t.user_id
      LEFT JOIN ws_tasks_l3 t3 ON t3.ws_task_id = COALESCE(
        el.details->>'ws_task_id',
        el.details->'exceeded_task'->>'id',
        el.details->'original_details'->>'ws_task_id'
      )
      LEFT JOIN ws_tasks_l2 t2 ON t2.ws_task_id = COALESCE(
        el.details->>'ws_task_id',
        el.details->'exceeded_task'->>'id',
        el.details->'original_details'->>'ws_task_id'
      )
      WHERE el.event_type LIKE '%revoked%'
        AND COALESCE(
          t3.date_closed::date,
          t2.date_closed::date,
          (el.details->'original_details'->>'date_closed')::date,
          el.event_date
        ) >= '2026-03-25'::date
        AND (p_from IS NULL OR t.created_at >= p_from)
        AND (p_to IS NULL OR t.created_at < p_to)
    )
    SELECT
      CASE p_level
        WHEN 'user' THEN b.user_id::text
        WHEN 'team' THEN COALESCE(b.team, '__no_team__')
        WHEN 'department' THEN COALESCE(b.department, '__no_dept__')
      END,
      CASE p_level
        WHEN 'user' THEN NULLIF(TRIM(COALESCE(b.first_name, '') || ' ' || COALESCE(b.last_name, '')), '')
        WHEN 'team' THEN COALESCE(b.team, 'Без команды')
        WHEN 'department' THEN COALESCE(b.department, 'Без отдела')
      END,
      SUM(ABS(b.coins))::bigint,
      NULL::bigint
    FROM base b
    GROUP BY 1, 2
    ORDER BY 3 DESC NULLS LAST;

  ELSIF p_source IN ('shop', 'lottery', 'second_life') THEN
    RETURN QUERY
    WITH base AS (
      SELECT u.id AS user_id, u.first_name, u.last_name, u.team, u.department, t.coins
      FROM shop_orders o
      JOIN gamification_transactions t ON t.id = o.transaction_id
      JOIN shop_products p ON p.id = o.product_id
      JOIN shop_categories c ON c.id = p.category_id
      JOIN ws_users u ON u.id = o.user_id
      WHERE o.status <> 'cancelled'
        AND (CASE p_source
          WHEN 'shop' THEN (c.slug <> 'draw' AND p.effect IS NULL)
          WHEN 'lottery' THEN (c.slug = 'draw')
          WHEN 'second_life' THEN (p.effect IN ('streak_shield_ws','streak_shield_revit'))
        END)
        AND (p_from IS NULL OR o.created_at >= p_from)
        AND (p_to IS NULL OR o.created_at < p_to)
    )
    SELECT
      CASE p_level
        WHEN 'user' THEN b.user_id::text
        WHEN 'team' THEN COALESCE(b.team, '__no_team__')
        WHEN 'department' THEN COALESCE(b.department, '__no_dept__')
      END,
      CASE p_level
        WHEN 'user' THEN NULLIF(TRIM(COALESCE(b.first_name, '') || ' ' || COALESCE(b.last_name, '')), '')
        WHEN 'team' THEN COALESCE(b.team, 'Без команды')
        WHEN 'department' THEN COALESCE(b.department, 'Без отдела')
      END,
      SUM(ABS(b.coins))::bigint,
      COUNT(*)::bigint
    FROM base b
    GROUP BY 1, 2
    ORDER BY 3 DESC NULLS LAST;

  ELSIF p_source = 'paid_gratitude' THEN
    RETURN QUERY
    WITH base AS (
      SELECT u.id AS user_id, u.first_name, u.last_name, u.team, u.department, g.coins_amount
      FROM gratitudes g
      JOIN ws_users u ON u.id = g.sender_id
      WHERE g.gift_source = 'balance'
        AND (p_from IS NULL OR g.created_at >= p_from)
        AND (p_to IS NULL OR g.created_at < p_to)
    )
    SELECT
      CASE p_level
        WHEN 'user' THEN b.user_id::text
        WHEN 'team' THEN COALESCE(b.team, '__no_team__')
        WHEN 'department' THEN COALESCE(b.department, '__no_dept__')
      END,
      CASE p_level
        WHEN 'user' THEN NULLIF(TRIM(COALESCE(b.first_name, '') || ' ' || COALESCE(b.last_name, '')), '')
        WHEN 'team' THEN COALESCE(b.team, 'Без команды')
        WHEN 'department' THEN COALESCE(b.department, 'Без отдела')
      END,
      SUM(b.coins_amount)::bigint,
      COUNT(*)::bigint
    FROM base b
    GROUP BY 1, 2
    ORDER BY 3 DESC NULLS LAST;

  ELSE
    RAISE EXCEPTION 'Unknown source: %', p_source;
  END IF;
END;
$function$
;
