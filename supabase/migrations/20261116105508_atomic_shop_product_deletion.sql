CREATE OR REPLACE FUNCTION public.delete_shop_product(
  p_product_id uuid,
  p_expected_updated_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_updated_at timestamptz;
BEGIN
  IF p_product_id IS NULL OR p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'shop_product_invalid_delete';
  END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'shop_product_requires_read_committed';
  END IF;

  -- Purchases take this lock first too. Check orders after obtaining it.
  SELECT updated_at INTO v_updated_at
  FROM public.shop_products
  WHERE id = p_product_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shop_product_not_found';
  END IF;
  IF v_updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'shop_product_changed';
  END IF;

  PERFORM 1 FROM public.bimo_catalog WHERE product_id = p_product_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.shop_orders WHERE product_id = p_product_id) THEN
    RAISE EXCEPTION 'shop_product_has_orders';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.bimo_equipment e
    JOIN public.bimo_catalog c ON c.asset_key = e.asset_key AND c.slot = e.slot
    WHERE c.product_id = p_product_id
  ) THEN
    RAISE EXCEPTION 'shop_product_equipped';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lottery_draws WHERE product_id = p_product_id) THEN
    RAISE EXCEPTION 'shop_product_has_lottery';
  END IF;

  DELETE FROM public.bimo_catalog WHERE product_id = p_product_id;
  DELETE FROM public.shop_products WHERE id = p_product_id;
  RETURN p_product_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_shop_product(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_shop_product(uuid, timestamptz) TO service_role;
