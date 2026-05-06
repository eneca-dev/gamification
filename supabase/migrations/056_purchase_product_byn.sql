-- 056_purchase_product_byn.sql
-- Rewrite purchase_product to compute price on the fly from cost_byn × coefficient × current_crystal_rate().
-- Drop shop_products.price column — single source of truth is cost_byn + coefficient + current rate.
-- cancel_order does not change: refund amount comes from the original transaction's coins, which is correct.

CREATE OR REPLACE FUNCTION public.purchase_product(p_product_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  v_user_email text;
  v_product_name text;
  v_cost_byn numeric;
  v_coefficient numeric;
  v_rate numeric;
  v_price integer;
  v_is_active boolean;
  v_stock integer;
  v_is_physical boolean;
  v_is_countable boolean;
  v_cat_is_active boolean;
  v_balance integer;
  v_order_id uuid;
  v_event_id uuid;
  v_tx_id uuid;
  v_order_status text;
BEGIN
  -- 0. Email покупателя
  SELECT email INTO v_user_email
  FROM public.ws_users WHERE id = p_user_id;
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Пользователь не найден в системе';
  END IF;

  -- 1. Товар + категория, блокировка строки товара
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

  -- 2. Текущий курс + цена в кристаллах (целое число)
  v_rate := public.current_crystal_rate();
  v_price := round(v_cost_byn * v_coefficient * v_rate)::integer;

  -- 3. Баланс с блокировкой
  SELECT total_coins INTO v_balance
  FROM public.gamification_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_balance < v_price THEN
    RAISE EXCEPTION 'Недостаточно коинов';
  END IF;

  -- 4. order_id
  v_order_id := gen_random_uuid();

  -- 5. Event log
  INSERT INTO public.gamification_event_logs (
    user_id, user_email, event_type, source, event_date,
    details, idempotency_key
  ) VALUES (
    p_user_id, v_user_email, 'shop_purchase', 'shop', CURRENT_DATE,
    jsonb_build_object('product_id', p_product_id, 'product_name', v_product_name, 'order_id', v_order_id),
    'shop_purchase_' || v_order_id::text
  )
  RETURNING id INTO v_event_id;

  -- 6. Транзакция списания (byn_amount проставит триггер trg_set_byn_amount)
  INSERT INTO public.gamification_transactions (
    user_id, user_email, event_id, coins
  ) VALUES (
    p_user_id, v_user_email, v_event_id, -v_price
  )
  RETURNING id INTO v_tx_id;

  -- 7. Баланс
  UPDATE public.gamification_balances
  SET total_coins = total_coins - v_price, updated_at = now()
  WHERE user_id = p_user_id;

  -- 8. Заказ
  v_order_status := CASE WHEN v_is_physical THEN 'pending' ELSE 'fulfilled' END;

  INSERT INTO public.shop_orders (
    id, user_id, product_id, status, transaction_id
  ) VALUES (
    v_order_id, p_user_id, p_product_id, v_order_status, v_tx_id
  );

  -- 9. Stock
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

-- Удаляем колонку price — единый источник истины теперь cost_byn × coefficient × current_rate
ALTER TABLE public.shop_products DROP COLUMN IF EXISTS price;
