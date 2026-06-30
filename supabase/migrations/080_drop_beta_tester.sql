-- Завершение бета-тестирования: доступ открыт всем.
-- Убираем параметр p_beta_only из RPC экономик-дашборда (поведение = расчёт по всем пользователям,
-- что эквивалентно прежнему p_beta_only = false) и удаляем колонку ws_users.is_beta_tester.
-- Тела функций взяты из актуальных версий: overview/top — миграция 053,
-- category_breakdown — 051, get_user_period_balance — 076.
-- Смена сигнатуры (удаление параметра) требует DROP + CREATE.

DROP FUNCTION IF EXISTS public.get_economy_overview(timestamptz, timestamptz, boolean);
DROP FUNCTION IF EXISTS public.get_economy_top(timestamptz, timestamptz, boolean, text, text);
DROP FUNCTION IF EXISTS public.get_economy_category_breakdown(timestamptz, timestamptz, boolean);
DROP FUNCTION IF EXISTS public.get_user_period_balance(timestamptz, timestamptz, boolean);

-- ---------------------------------------------------------------------------
-- get_economy_overview
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.get_economy_overview(
  p_from timestamptz,
  p_to timestamptz
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
$$;

REVOKE EXECUTE ON FUNCTION public.get_economy_overview(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_economy_overview(timestamptz, timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- get_economy_top
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.get_economy_top(
  p_from timestamptz,
  p_to timestamptz,
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
$$;

REVOKE EXECUTE ON FUNCTION public.get_economy_top(timestamptz, timestamptz, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_economy_top(timestamptz, timestamptz, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- get_economy_category_breakdown
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.get_economy_category_breakdown(
  p_from timestamptz,
  p_to timestamptz
) RETURNS TABLE(
  category_id uuid,
  category_name text,
  coins bigint,
  orders bigint,
  products jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH product_stats AS (
    SELECT
      p.id AS product_id,
      p.category_id,
      p.name AS product_name,
      p.emoji,
      p.image_url,
      SUM(ABS(t.coins))::bigint AS coins,
      COUNT(*)::bigint AS orders
    FROM shop_orders o
    JOIN gamification_transactions t ON t.id = o.transaction_id
    JOIN shop_products p ON p.id = o.product_id
    JOIN ws_users u ON u.id = o.user_id
    WHERE o.status <> 'cancelled'
      AND (p_from IS NULL OR o.created_at >= p_from)
      AND (p_to IS NULL OR o.created_at < p_to)
    GROUP BY p.id, p.category_id, p.name, p.emoji, p.image_url
  )
  SELECT
    c.id,
    c.name,
    COALESCE(SUM(ps.coins), 0)::bigint,
    COALESCE(SUM(ps.orders), 0)::bigint,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', ps.product_id,
          'name', ps.product_name,
          'emoji', ps.emoji,
          'image_url', ps.image_url,
          'coins', ps.coins,
          'orders', ps.orders
        )
        ORDER BY ps.coins DESC
      ) FILTER (WHERE ps.product_id IS NOT NULL),
      '[]'::jsonb
    )
  FROM shop_categories c
  LEFT JOIN product_stats ps ON ps.category_id = c.id
  GROUP BY c.id, c.name
  HAVING COALESCE(SUM(ps.coins), 0) > 0
  ORDER BY COALESCE(SUM(ps.coins), 0) DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_economy_category_breakdown(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_economy_category_breakdown(timestamptz, timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- get_user_period_balance
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.get_user_period_balance(
  p_from timestamptz,
  p_to timestamptz
) RETURNS TABLE(
  user_id uuid,
  first_name text,
  last_name text,
  email text,
  department text,
  team text,
  net_coins bigint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_from IS NULL AND p_to IS NULL THEN
    -- All-time: читаем предрассчитанный баланс
    RETURN QUERY
    SELECT
      u.id,
      u.first_name,
      u.last_name,
      u.email,
      u.department,
      u.team,
      COALESCE(gb.total_coins, 0)::bigint
    FROM ws_users u
    LEFT JOIN gamification_balances gb ON gb.user_id = u.id
    WHERE u.is_active = true
      AND u.team IS DISTINCT FROM 'Декретный'
    ORDER BY COALESCE(gb.total_coins, 0);
  ELSE
    -- Конкретный период: суммируем транзакции в диапазоне
    RETURN QUERY
    SELECT
      u.id,
      u.first_name,
      u.last_name,
      u.email,
      u.department,
      u.team,
      COALESCE(SUM(t.coins), 0)::bigint AS net_coins
    FROM ws_users u
    LEFT JOIN gamification_transactions t ON t.user_id = u.id
      AND (p_from IS NULL OR t.created_at >= p_from)
      AND (p_to IS NULL OR t.created_at < p_to)
    WHERE u.is_active = true
      AND u.team IS DISTINCT FROM 'Декретный'
    GROUP BY u.id, u.first_name, u.last_name, u.email, u.department, u.team
    ORDER BY net_coins;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_period_balance(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_period_balance(timestamptz, timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- Удаление колонки (после пересоздания функций, которые на неё ссылались)
-- ---------------------------------------------------------------------------
ALTER TABLE public.ws_users DROP COLUMN IF EXISTS is_beta_tester;
