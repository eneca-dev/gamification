-- Add opportunity-based monthly engagement metrics.
-- Tables, rows, and legacy production functions are not changed.

CREATE OR REPLACE FUNCTION public.get_adoption_monthly_summary_v3(
  p_from date,
  p_to date,
  p_scope text DEFAULT 'designer',
  p_departments text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
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
$fn$;

REVOKE ALL ON FUNCTION public.get_adoption_monthly_summary_v3(date,date,text,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_adoption_monthly_summary_v3(date,date,text,text[]) TO service_role;
