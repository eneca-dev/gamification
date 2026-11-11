-- Approved additive setup. Apply once through Supabase MCP apply_migration.
-- No updates/deletes, existing table/function/policy changes, purchases or uploads.
-- Free classic outfit and mint background are implicit application defaults.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.shop_categories
    WHERE slug = 'artifact' AND is_active AND NOT is_physical AND NOT is_countable
  ) THEN
    RAISE EXCEPTION 'Expected active nonphysical, noncountable artifact category';
  END IF;
  IF public.current_crystal_rate() IS NULL OR public.current_crystal_rate() <= 0 THEN
    RAISE EXCEPTION 'A positive crystal rate is required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.shop_products WHERE effect LIKE 'bimo:%') THEN
    RAISE EXCEPTION 'Bimo products already exist; inspect instead of duplicating';
  END IF;
END;
$$;

CREATE TABLE public.bimo_catalog (
  asset_key text PRIMARY KEY,
  slot text NOT NULL CHECK (slot IN ('outfit', 'accessory', 'background')),
  product_id uuid NOT NULL UNIQUE REFERENCES public.shop_products(id) ON DELETE RESTRICT,
  is_released boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bimo_catalog_key_format CHECK (asset_key ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  CONSTRAINT bimo_catalog_key_slot CHECK (split_part(asset_key, '.', 1) = slot),
  UNIQUE (asset_key, slot)
);

CREATE TABLE public.bimo_equipment (
  user_id uuid NOT NULL REFERENCES public.ws_users(id) ON DELETE CASCADE,
  slot text NOT NULL CHECK (slot IN ('outfit', 'accessory', 'background')),
  asset_key text NOT NULL,
  source_order_id uuid NOT NULL REFERENCES public.shop_orders(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, slot),
  FOREIGN KEY (asset_key, slot) REFERENCES public.bimo_catalog(asset_key, slot) ON DELETE RESTRICT
);
CREATE INDEX bimo_equipment_asset_slot_idx ON public.bimo_equipment(asset_key, slot);
CREATE INDEX bimo_equipment_source_order_idx ON public.bimo_equipment(source_order_id);

-- Server-only preparation. No client policies or direct client writes.
ALTER TABLE public.bimo_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bimo_equipment ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bimo_catalog, public.bimo_equipment FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bimo_catalog, public.bimo_equipment TO service_role;

COMMENT ON TABLE public.bimo_catalog IS 'V2 Bimo catalog. Release requires explicit review; metadata alone does not publish a shop product.';
COMMENT ON TABLE public.bimo_equipment IS 'One paid item per user/slot. Future server operations must validate order owner, product, fulfilled status and absence of refund; stale invalid orders must fall back to defaults.';

WITH items(asset_key, slot, title, description, emoji, sort_order) AS (
  VALUES
    ('outfit.hoodie', 'outfit', 'Уютный день', 'Кремовое худи с небольшим зелёным значком.', '🧥', 1000),
    ('outfit.lavender_sweater', 'outfit', 'Творческое настроение', 'Лавандовый свитер с заметной фактурой.', '🧶', 1001),
    ('outfit.blue_bomber', 'outfit', 'Городской', 'Синий бомбер со светлыми манжетами.', '🧥', 1002),
    ('outfit.coral_shirt', 'outfit', 'Отпуск', 'Коралловая рубашка с крупным спокойным узором.', '👕', 1003),
    ('accessory.round_glasses', 'accessory', 'Круглые очки', 'Тонкая тёмная оправа, которая следует за движениями головы.', '👓', 1010),
    ('accessory.blue_headphones', 'accessory', 'Голубые наушники', 'Голубые наушники для Бимо.', '🎧', 1011),
    ('accessory.mint_cap', 'accessory', 'Мятная кепка', 'Мятная кепка с прорезями для ушек.', '🧢', 1012),
    ('accessory.blue_beanie', 'accessory', 'Синяя шапочка', 'Вязаная шапочка, из которой выглядывают уши.', '🧶', 1013),
    ('accessory.lavender_beret', 'accessory', 'Лавандовый берет', 'Мягкий лавандовый берет для Бимо.', '🎨', 1014),
    ('accessory.coral_scarf', 'accessory', 'Коралловый шарфик', 'Короткий шарфик, который не закрывает мордочку и лапы.', '🧣', 1015),
    ('background.peach', 'background', 'Персиковый', 'Тёплый пастельный фон в общей форме сценки.', '🍑', 1020),
    ('background.lavender', 'background', 'Лавандовый', 'Сиреневый градиент с несколькими светлыми точками.', '💜', 1021),
    ('background.clouds', 'background', 'Над облаками', 'Голубое небо в арке и пушистые облачка у основания.', '☁️', 1022),
    ('background.office', 'background', 'Уютный офис', 'Окно, растение и край стола; справа место для презентации.', '🪴', 1023),
    ('background.beach', 'background', 'Пляж', 'Песок, море и солнце, пальмовый лист сбоку.', '🏖️', 1024),
    ('background.starry_evening', 'background', 'Звёздный вечер', 'Приглушённое синее небо, месяц и несколько звёзд.', '🌙', 1025),
    ('background.green_courtyard', 'background', 'Зелёный дворик', 'Светлая зелень, кустики и маленькие цветы у основания.', '🌿', 1026)
), inserted AS (
  INSERT INTO public.shop_products (
    name, description, category_id, emoji, effect, is_active, is_coming_soon,
    stock, sort_order, cost_byn, coefficient, price_adjustment_crystals, media
  )
  SELECT 'Бимо · ' || title, description,
    (SELECT id FROM public.shop_categories WHERE slug = 'artifact'),
    emoji, 'bimo:' || asset_key, false, false,
    NULL, sort_order, round(200::numeric / public.current_crystal_rate(), 2), 1, 0, '[]'::jsonb
  FROM items
  RETURNING id, effect
)
INSERT INTO public.bimo_catalog(asset_key, slot, product_id)
SELECT i.asset_key, i.slot, p.id FROM items i JOIN inserted p ON p.effect = 'bimo:' || i.asset_key;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.bimo_catalog) <> 17
     OR (SELECT count(*) FROM public.shop_products WHERE effect LIKE 'bimo:%') <> 17
     OR EXISTS (
       SELECT 1 FROM public.bimo_catalog c JOIN public.shop_products p ON p.id = c.product_id
       WHERE c.is_released OR p.is_active OR p.is_coming_soon
     ) THEN
    RAISE EXCEPTION 'Bimo draft verification failed';
  END IF;
END;
$$;
