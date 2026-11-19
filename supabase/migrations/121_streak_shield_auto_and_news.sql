-- Предоплаченные защиты и глобальный переключатель (по умолчанию выключен).
CREATE TABLE public.streak_shield_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  auto_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.streak_shield_settings (id) VALUES (true);
ALTER TABLE public.streak_shield_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.streak_shield_credits (
  order_id uuid PRIMARY KEY REFERENCES public.shop_orders(id),
  user_id uuid NOT NULL REFERENCES public.ws_users(id),
  shield_type text NOT NULL CHECK (shield_type IN ('ws', 'revit')),
  purchased_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);
CREATE INDEX streak_shield_credits_available_idx
  ON public.streak_shield_credits (user_id, shield_type, purchased_at)
  WHERE consumed_at IS NULL;
ALTER TABLE public.streak_shield_credits ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX streak_shield_log_once_per_day_idx
  ON public.streak_shield_log (user_id, shield_type, protected_date);

-- Все вызовы идут с сервера через service_role. Таблицы не открываются клиенту.
GRANT SELECT, UPDATE ON public.streak_shield_settings TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.streak_shield_credits TO service_role;

CREATE OR REPLACE FUNCTION public.purchase_streak_shield_credit(p_user_id uuid, p_shield_type text)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_product_id uuid; v_purchase jsonb;
BEGIN
  IF p_shield_type NOT IN ('ws', 'revit') THEN RAISE EXCEPTION 'Неверный тип защиты'; END IF;
  SELECT id INTO v_product_id FROM public.shop_products
  WHERE effect = 'streak_shield_' || p_shield_type AND is_active = true LIMIT 1;
  IF v_product_id IS NULL THEN RAISE EXCEPTION 'Товар недоступен'; END IF;
  v_purchase := public.purchase_product(v_product_id, p_user_id, NULL::text);
  INSERT INTO public.streak_shield_credits(order_id, user_id, shield_type)
  VALUES ((v_purchase->>'order_id')::uuid, p_user_id, p_shield_type);
  RETURN v_purchase;
END $$;

CREATE OR REPLACE FUNCTION public.use_streak_shield(
  p_user_id uuid, p_shield_type text, p_automatic boolean DEFAULT false
)
RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_pending date; v_expires timestamptz; v_month date;
  v_free_used integer; v_order_id uuid; v_product_id uuid; v_is_free boolean := false;
BEGIN
  IF p_shield_type NOT IN ('ws', 'revit') THEN RAISE EXCEPTION 'Неверный тип защиты'; END IF;
  IF p_automatic AND NOT EXISTS (
    SELECT 1 FROM public.streak_shield_settings WHERE id = true AND auto_enabled = true
  ) THEN RETURN false; END IF;

  IF p_shield_type = 'ws' THEN
    SELECT pending_reset_date, pending_reset_expires_at INTO v_pending, v_expires
    FROM public.ws_user_streaks WHERE user_id = p_user_id FOR UPDATE;
  ELSE
    SELECT pending_reset_date, pending_reset_expires_at INTO v_pending, v_expires
    FROM public.revit_user_streaks WHERE user_id = p_user_id FOR UPDATE;
  END IF;
  IF v_pending IS NULL OR v_expires IS NULL OR v_expires <= now() THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.streak_shield_log
    WHERE user_id = p_user_id AND shield_type = p_shield_type AND protected_date = v_pending
  ) THEN RETURN false; END IF;

  v_month := date_trunc('month', now() AT TIME ZONE 'Europe/Minsk')::date;
  INSERT INTO public.streak_shield_quota(user_id, shield_type, month)
  VALUES (p_user_id, p_shield_type, v_month)
  ON CONFLICT (user_id, shield_type, month) DO NOTHING;
  SELECT free_used INTO v_free_used FROM public.streak_shield_quota
  WHERE user_id = p_user_id AND shield_type = p_shield_type AND month = v_month FOR UPDATE;

  IF v_free_used < 2 THEN
    SELECT id INTO v_product_id FROM public.shop_products
    WHERE effect = 'streak_shield_' || p_shield_type AND is_active = true LIMIT 1;
    IF v_product_id IS NULL THEN RAISE EXCEPTION 'Товар недоступен'; END IF;
    v_order_id := (public.purchase_product(v_product_id, p_user_id, true)->>'order_id')::uuid;
    UPDATE public.streak_shield_quota SET free_used = free_used + 1
    WHERE user_id = p_user_id AND shield_type = p_shield_type AND month = v_month;
    v_is_free := true;
  ELSE
    SELECT order_id INTO v_order_id FROM public.streak_shield_credits
    WHERE user_id = p_user_id AND shield_type = p_shield_type AND consumed_at IS NULL
    ORDER BY purchased_at, order_id LIMIT 1 FOR UPDATE;
    IF v_order_id IS NULL THEN RETURN false; END IF;
    UPDATE public.streak_shield_credits SET consumed_at = now() WHERE order_id = v_order_id;
    UPDATE public.streak_shield_quota SET paid_used = paid_used + 1
    WHERE user_id = p_user_id AND shield_type = p_shield_type AND month = v_month;
  END IF;

  INSERT INTO public.streak_shield_log(user_id, shield_type, protected_date, order_id, is_free)
  VALUES (p_user_id, p_shield_type, v_pending, v_order_id, v_is_free);
  IF p_shield_type = 'ws' THEN
    UPDATE public.ws_user_streaks SET pending_reset_date = NULL, pending_reset_expires_at = NULL, updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    UPDATE public.revit_user_streaks SET pending_reset_date = NULL, pending_reset_expires_at = NULL,
      pending_gap_days = NULL, updated_at = now() WHERE user_id = p_user_id;
  END IF;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.purchase_streak_shield_credit(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.use_streak_shield(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_streak_shield_credit(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.use_streak_shield(uuid, text, boolean) TO service_role;

-- Новости: категория содержания и адресат являются разными полями.
CREATE TABLE public.company_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 160),
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 5000),
  category text NOT NULL CHECK (category IN ('plugins', 'regulations', 'tips', 'bug', 'other')),
  department_code text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_news_feed_idx ON public.company_news (published_at DESC) WHERE published_at IS NOT NULL;
ALTER TABLE public.company_news ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_news TO service_role;
