-- Возвращает пользователей с их балансом за период (или all-time если p_from/p_to = NULL).
-- Для p_from=NULL AND p_to=NULL: использует gamification_balances (текущий накопленный баланс).
-- Для конкретного периода: суммирует gamification_transactions в диапазоне.
-- Используется в EconomyDashboard для секций «Группа риска» и «Самые богатые».

CREATE OR REPLACE FUNCTION public.get_user_period_balance(
  p_from timestamptz,
  p_to timestamptz,
  p_beta_only boolean
) RETURNS TABLE(
  user_id uuid,
  first_name text,
  last_name text,
  email text,
  department text,
  team text,
  is_beta_tester boolean,
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
      u.is_beta_tester,
      COALESCE(gb.total_coins, 0)::bigint
    FROM ws_users u
    LEFT JOIN gamification_balances gb ON gb.user_id = u.id
    WHERE u.is_active = true
      AND u.team IS DISTINCT FROM 'Декретный'
      AND (NOT p_beta_only OR u.is_beta_tester)
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
      u.is_beta_tester,
      COALESCE(SUM(t.coins), 0)::bigint AS net_coins
    FROM ws_users u
    LEFT JOIN gamification_transactions t ON t.user_id = u.id
      AND (p_from IS NULL OR t.created_at >= p_from)
      AND (p_to IS NULL OR t.created_at < p_to)
    WHERE u.is_active = true
      AND u.team IS DISTINCT FROM 'Декретный'
      AND (NOT p_beta_only OR u.is_beta_tester)
    GROUP BY u.id, u.first_name, u.last_name, u.email, u.department, u.team, u.is_beta_tester
    ORDER BY net_coins;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_period_balance(timestamptz, timestamptz, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_period_balance(timestamptz, timestamptz, boolean) TO service_role;
