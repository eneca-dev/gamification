-- Approved additive RPCs. Apply once through Supabase MCP.
-- Existing functions/tables/products are not modified by this migration.
-- Server-only: p_user_id must come from the verified server session, never client input.

CREATE FUNCTION public.purchase_bimo_item(
  p_product_id uuid,
  p_user_id uuid,
  p_user_comment text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_asset_key text;
  v_slot text;
  v_result jsonb;
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'bimo_requires_read_committed';
  END IF;
  IF p_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.ws_users WHERE id = p_user_id AND is_active
  ) THEN
    RAISE EXCEPTION 'bimo_user_not_found';
  END IF;

  -- Same first payment lock as purchase_product. Concurrent purchases of this
  -- product wait here; the ownership query below gets a fresh READ COMMITTED snapshot.
  -- Catalog/category share locks also prevent a release/configuration change mid-payment.
  SELECT c.asset_key, c.slot INTO v_asset_key, v_slot
  FROM public.shop_products p
  JOIN public.bimo_catalog c ON c.product_id = p.id
  JOIN public.shop_categories cat ON cat.id = p.category_id
  WHERE p.id = p_product_id
    AND c.is_released AND p.is_active AND NOT p.is_coming_soon
    AND cat.is_active AND NOT cat.is_physical AND NOT cat.is_countable
    AND cat.slug = 'artifact' AND p.effect = 'bimo:' || c.asset_key
  FOR UPDATE OF p FOR SHARE OF c, cat;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'bimo_item_unavailable';
  END IF;

  -- Pending/processing purchases also block another payment. Only cancelled or
  -- refunded orders allow repurchase; only fulfilled orders can be equipped.
  IF EXISTS (
    SELECT 1 FROM public.shop_orders
    WHERE user_id = p_user_id AND product_id = p_product_id
      AND status <> 'cancelled' AND refund_transaction_id IS NULL
  ) THEN
    RAISE EXCEPTION 'bimo_already_owned';
  END IF;

  -- Named text argument resolves the paid/comment overload, never p_free.
  -- This call shares the outer transaction: any failure rolls back all payment writes.
  v_result := public.purchase_product(
    p_product_id => p_product_id,
    p_user_id => p_user_id,
    p_user_comment => p_user_comment
  );
  RETURN v_result || jsonb_build_object('asset_key', v_asset_key, 'slot', v_slot);
END;
$function$;

CREATE FUNCTION public.equip_bimo_item(
  p_user_id uuid,
  p_slot text,
  p_asset_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_product_id uuid;
  v_order_id uuid;
BEGIN
  IF p_slot IS NULL OR p_slot NOT IN ('outfit', 'accessory', 'background') THEN
    RAISE EXCEPTION 'bimo_invalid_slot';
  END IF;

  -- Serializes equipment changes for this user, including clearing an empty slot.
  PERFORM 1 FROM public.ws_users WHERE id = p_user_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'bimo_user_not_found';
  END IF;

  -- NULL clears this slot: classic outfit / mint background / no accessory.
  IF p_asset_key IS NULL THEN
    DELETE FROM public.bimo_equipment WHERE user_id = p_user_id AND slot = p_slot;
    RETURN jsonb_build_object('slot', p_slot, 'asset_key', NULL, 'source_order_id', NULL);
  END IF;

  -- Already-owned delisted products can still be worn. An unreleased catalog item cannot.
  SELECT product_id INTO v_product_id
  FROM public.bimo_catalog
  WHERE asset_key = p_asset_key AND slot = p_slot AND is_released
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'bimo_item_unavailable';
  END IF;

  -- Locks the source order against concurrent cancellation/refund. A later refund
  -- invalidates effective appearance at read time; no existing refund trigger is changed.
  SELECT id INTO v_order_id FROM public.shop_orders
  WHERE user_id = p_user_id AND product_id = v_product_id
    AND status = 'fulfilled' AND refund_transaction_id IS NULL
  ORDER BY created_at, id
  LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'bimo_not_owned';
  END IF;

  INSERT INTO public.bimo_equipment(user_id, slot, asset_key, source_order_id)
  VALUES (p_user_id, p_slot, p_asset_key, v_order_id)
  ON CONFLICT (user_id, slot) DO UPDATE
  SET asset_key = EXCLUDED.asset_key,
      source_order_id = EXCLUDED.source_order_id,
      updated_at = now();

  RETURN jsonb_build_object('slot', p_slot, 'asset_key', p_asset_key, 'source_order_id', v_order_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.purchase_bimo_item(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.equip_bimo_item(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_bimo_item(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.equip_bimo_item(uuid, text, text) TO service_role;

COMMENT ON FUNCTION public.purchase_bimo_item(uuid, uuid, text) IS
  'Server-only Bimo purchase wrapper. Pass session-derived ws user ID. Uses existing paid purchase_product; serializes duplicate checks using the product lock.';
COMMENT ON FUNCTION public.equip_bimo_item(uuid, text, text) IS
  'Server-only Bimo equipment. NULL asset clears a slot. Effective appearance must revalidate source order owner/product/status/refund and catalog release after later refunds.';
