-- «Покупка в магазине» не включает выдачу/использование «Второй жизни».
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
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN RAISE EXCEPTION 'Invalid monthly report period'; END IF;
  IF p_scope NOT IN ('designer', 'all', 'selected') THEN RAISE EXCEPTION 'Invalid cohort scope'; END IF;

  WITH cohort AS (
    SELECT u.id, lower(u.email) AS email
    FROM ws_users u
    WHERE u.is_active = true AND u.team IS DISTINCT FROM 'Декретный'
      AND (p_scope = 'all' OR (p_scope = 'designer' AND EXISTS (
        SELECT 1 FROM admin_department_groups g WHERE g.department = u.department AND g.group_type = 'designer'
      )) OR (p_scope = 'selected' AND u.department = ANY(COALESCE(p_departments, ARRAY[]::text[]))))
  ), actions AS (
    SELECT g.sender_id AS user_id, 'gratitude'::text AS action FROM gratitudes g
    WHERE g.created_at >= p_from AND g.created_at < p_to + 1 AND g.sender_id IN (SELECT id FROM cohort)
    UNION
    SELECT o.user_id, 'shop'::text FROM shop_orders o
    JOIN shop_products p ON p.id = o.product_id
    WHERE o.created_at >= p_from AND o.created_at < p_to + 1 AND o.status <> 'cancelled'
      AND p.effect IS NULL AND o.user_id IN (SELECT id FROM cohort)
    UNION
    SELECT s.user_id, 'shield'::text FROM streak_shield_log s
    WHERE s.created_at >= p_from AND s.created_at < p_to + 1 AND s.user_id IN (SELECT id FROM cohort)
  ), statuses AS (
    SELECT user_id, date, status, red_reasons FROM ws_daily_statuses WHERE date BETWEEN p_from AND p_to AND user_id IN (SELECT id FROM cohort)
    UNION ALL
    SELECT user_id, date, status, red_reasons FROM ws_daily_statuses_baseline WHERE date BETWEEN p_from AND p_to AND user_id IN (SELECT id FROM cohort)
  ), tx AS (
    SELECT t.user_id, t.coins FROM gamification_transactions t
    WHERE t.created_at >= p_from AND t.created_at < p_to + 1 AND t.user_id IN (SELECT id FROM cohort)
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
