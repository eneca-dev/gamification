-- Экономический дашборд: отзывы за задачи, закрытые до 2026-03-25, не учитываем.
-- Для всех revoke-типов event_date — это дата закрытия задачи, спровоцировавшей revoke
-- (revoke фиксируется при закрытии задачи), поэтому фильтр на event_date эквивалентен
-- фильтру по дате закрытия задачи.

CREATE OR REPLACE FUNCTION public.get_economy_overview(
  p_from timestamptz,
  p_to timestamptz,
  p_beta_only boolean
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH
  earned AS (
    SELECT COALESCE(SUM(t.coins), 0)::bigint AS total
    FROM gamification_transactions t
    JOIN ws_users u ON u.id = t.user_id
    WHERE t.coins > 0
      AND (p_from IS NULL OR t.created_at >= p_from)
      AND (p_to IS NULL OR t.created_at < p_to)
      AND (NOT p_beta_only OR u.is_beta_tester)
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
    WHERE el.event_type LIKE '%revoked%'
      AND et.coins < 0
      AND t.coins <= 0
      AND el.event_date >= '2026-03-25'::date
      AND (p_from IS NULL OR t.created_at >= p_from)
      AND (p_to IS NULL OR t.created_at < p_to)
      AND (NOT p_beta_only OR u.is_beta_tester)
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
      AND (NOT p_beta_only OR u.is_beta_tester)
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
      AND (NOT p_beta_only OR u.is_beta_tester)
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
      AND (NOT p_beta_only OR u.is_beta_tester)
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
      AND (NOT p_beta_only OR u.is_beta_tester)
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
      AND (NOT p_beta_only OR u.is_beta_tester)
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
$$;

REVOKE EXECUTE ON FUNCTION public.get_economy_overview(timestamptz, timestamptz, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_economy_overview(timestamptz, timestamptz, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.get_economy_top(
  p_from timestamptz,
  p_to timestamptz,
  p_beta_only boolean,
  p_source text,
  p_level text
) RETURNS TABLE(id text, name text, value bigint, secondary bigint)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
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
        AND (NOT p_beta_only OR u.is_beta_tester)
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
      WHERE el.event_type LIKE '%revoked%'
        AND el.event_date >= '2026-03-25'::date
        AND (p_from IS NULL OR t.created_at >= p_from)
        AND (p_to IS NULL OR t.created_at < p_to)
        AND (NOT p_beta_only OR u.is_beta_tester)
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
        AND (NOT p_beta_only OR u.is_beta_tester)
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
        AND (NOT p_beta_only OR u.is_beta_tester)
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
$$;

REVOKE EXECUTE ON FUNCTION public.get_economy_top(timestamptz, timestamptz, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_economy_top(timestamptz, timestamptz, boolean, text, text) TO service_role;
