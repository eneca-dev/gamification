-- ============================================================
-- Миграция: Механика лотереи
-- Ежемесячный розыгрыш дорогого лота. Сотрудники покупают
-- билеты (shop_product), победитель определяется рандомом.
-- ============================================================

-- 1. Таблица лотерей
CREATE TABLE lottery_draws (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  description     text,
  image_url       text,
  ticket_price    integer NOT NULL DEFAULT 300 CHECK (ticket_price > 0),
  product_id      uuid NOT NULL REFERENCES shop_products(id),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  month           date NOT NULL UNIQUE,
  winner_user_id  uuid REFERENCES ws_users(id),
  drawn_at        timestamptz,
  created_by      uuid NOT NULL REFERENCES ws_users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- month всегда должен быть 1-м числом
  CONSTRAINT lottery_draws_month_first_day CHECK (EXTRACT(DAY FROM month) = 1),
  -- только 1 active лотерея
  CONSTRAINT lottery_draws_one_active EXCLUDE USING btree (status WITH =) WHERE (status = 'active')
);

ALTER TABLE lottery_draws ENABLE ROW LEVEL SECURITY;

-- RLS: все аутентифицированные видят лотереи
CREATE POLICY "Authenticated can read lottery_draws"
  ON lottery_draws FOR SELECT TO authenticated
  USING (true);

-- RLS: service_role — полный доступ
CREATE POLICY "Service role full access on lottery_draws"
  ON lottery_draws FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Индекс для быстрого поиска активной лотереи
CREATE INDEX idx_lottery_draws_status ON lottery_draws(status) WHERE status = 'active';

-- 2. RPC: розыгрыш победителя
CREATE OR REPLACE FUNCTION public.draw_lottery_winner(p_lottery_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY INVOKER
AS $$
DECLARE
  v_lottery_status text;
  v_product_id uuid;
  v_winner_user_id uuid;
  v_winner_email text;
  v_winner_first_name text;
  v_winner_last_name text;
  v_total_tickets integer;
BEGIN
  -- 0. Блокируем лотерею
  SELECT status, product_id
  INTO v_lottery_status, v_product_id
  FROM public.lottery_draws
  WHERE id = p_lottery_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Лотерея не найдена';
  END IF;
  IF v_lottery_status != 'active' THEN
    RAISE EXCEPTION 'Лотерея уже завершена';
  END IF;

  -- 1. Считаем билеты
  SELECT COUNT(*)
  INTO v_total_tickets
  FROM public.shop_orders
  WHERE product_id = v_product_id
    AND status != 'cancelled';

  IF v_total_tickets = 0 THEN
    RAISE EXCEPTION 'Нет купленных билетов';
  END IF;

  -- 2. Рандомный победитель среди купленных билетов
  SELECT o.user_id, w.email, w.first_name, w.last_name
  INTO v_winner_user_id, v_winner_email, v_winner_first_name, v_winner_last_name
  FROM public.shop_orders o
  JOIN public.ws_users w ON o.user_id = w.id
  WHERE o.product_id = v_product_id
    AND o.status != 'cancelled'
  ORDER BY random()
  LIMIT 1;

  -- 3. Обновляем лотерею
  UPDATE public.lottery_draws SET
    status = 'completed',
    winner_user_id = v_winner_user_id,
    drawn_at = now()
  WHERE id = p_lottery_id;

  -- 4. Деактивируем товар-билет
  UPDATE public.shop_products SET
    is_active = false,
    updated_at = now()
  WHERE id = v_product_id;

  RETURN jsonb_build_object(
    'winner_user_id', v_winner_user_id,
    'winner_email', v_winner_email,
    'winner_name', v_winner_first_name || ' ' || v_winner_last_name,
    'total_tickets', v_total_tickets
  );
END;
$$;
