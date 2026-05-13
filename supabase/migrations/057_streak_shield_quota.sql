-- ============================================================
-- Миграция: Бесплатные вторые жизни (2 в месяц на тип)
-- ============================================================

-- 1. Колонка is_free в streak_shield_log
ALTER TABLE streak_shield_log ADD COLUMN is_free boolean NOT NULL DEFAULT false;

-- 2. Таблица квот: учёт использований по месяцам
CREATE TABLE streak_shield_quota (
  user_id     uuid NOT NULL REFERENCES ws_users(id),
  shield_type text NOT NULL CHECK (shield_type IN ('ws', 'revit')),
  month       date NOT NULL, -- первый день месяца, напр. 2026-05-01
  free_used   smallint NOT NULL DEFAULT 0 CHECK (free_used >= 0),
  paid_used   smallint NOT NULL DEFAULT 0 CHECK (paid_used >= 0),
  PRIMARY KEY (user_id, shield_type, month)
);

ALTER TABLE streak_shield_quota ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own quota"
  ON streak_shield_quota FOR SELECT TO authenticated
  USING (user_id = public.my_ws_user_id());

CREATE POLICY "Admins can read all quotas"
  ON streak_shield_quota FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ws_users
      WHERE ws_users.id = public.my_ws_user_id()
        AND ws_users.is_admin = true
    )
  );

CREATE POLICY "Service role full access on streak_shield_quota"
  ON streak_shield_quota FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3. Расширяем purchase_product параметром p_free
--    Если p_free = true: цена обнуляется, проверка баланса пропускается,
--    транзакция создаётся с coins = 0, баланс не меняется.
CREATE OR REPLACE FUNCTION public.purchase_product(
  p_product_id uuid,
  p_user_id    uuid,
  p_free       boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  v_user_email    text;
  v_product_name  text;
  v_cost_byn      numeric;
  v_coefficient   numeric;
  v_rate          numeric;
  v_price         integer;
  v_is_active     boolean;
  v_stock         integer;
  v_is_physical   boolean;
  v_is_countable  boolean;
  v_cat_is_active boolean;
  v_balance       integer;
  v_order_id      uuid;
  v_event_id      uuid;
  v_tx_id         uuid;
  v_order_status  text;
BEGIN
  SELECT email INTO v_user_email
  FROM public.ws_users WHERE id = p_user_id;
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Пользователь не найден в системе';
  END IF;

  SELECT p.name, p.cost_byn, p.coefficient, p.is_active, p.stock,
         c.is_physical, c.is_countable, c.is_active
  INTO v_product_name, v_cost_byn, v_coefficient, v_is_active, v_stock,
       v_is_physical, v_is_countable, v_cat_is_active
  FROM public.shop_products p
  JOIN public.shop_categories c ON p.category_id = c.id
  WHERE p.id = p_product_id
  FOR UPDATE OF p;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Товар не найден';
  END IF;
  IF NOT v_is_active OR NOT v_cat_is_active THEN
    RAISE EXCEPTION 'Товар недоступен';
  END IF;
  IF v_is_countable AND v_stock IS NOT NULL AND v_stock = 0 THEN
    RAISE EXCEPTION 'Нет в наличии';
  END IF;

  IF p_free THEN
    v_price := 0;
  ELSE
    v_rate  := public.current_crystal_rate();
    v_price := round(v_cost_byn * v_coefficient * v_rate)::integer;

    SELECT total_coins INTO v_balance
    FROM public.gamification_balances
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND OR v_balance < v_price THEN
      RAISE EXCEPTION 'Недостаточно коинов';
    END IF;
  END IF;

  v_order_id := gen_random_uuid();

  INSERT INTO public.gamification_event_logs (
    user_id, user_email, event_type, source, event_date,
    details, idempotency_key
  ) VALUES (
    p_user_id, v_user_email, 'shop_purchase', 'shop', CURRENT_DATE,
    jsonb_build_object('product_id', p_product_id, 'product_name', v_product_name, 'order_id', v_order_id, 'is_free', p_free),
    'shop_purchase_' || v_order_id::text
  )
  RETURNING id INTO v_event_id;

  INSERT INTO public.gamification_transactions (
    user_id, user_email, event_id, coins
  ) VALUES (
    p_user_id, v_user_email, v_event_id, -v_price
  )
  RETURNING id INTO v_tx_id;

  IF NOT p_free THEN
    UPDATE public.gamification_balances
    SET total_coins = total_coins - v_price, updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  v_order_status := CASE WHEN v_is_physical THEN 'pending' ELSE 'fulfilled' END;

  INSERT INTO public.shop_orders (
    id, user_id, product_id, status, transaction_id
  ) VALUES (
    v_order_id, p_user_id, p_product_id, v_order_status, v_tx_id
  );

  IF v_is_countable AND v_stock IS NOT NULL THEN
    UPDATE public.shop_products
    SET stock = stock - 1, updated_at = now()
    WHERE id = p_product_id;
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'status', v_order_status,
    'coins_spent', v_price
  );
END;
$function$;
