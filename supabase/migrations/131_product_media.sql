-- Карточка товара: несколько медиа (фото + YouTube-ссылки)
-- Элемент массива: { "kind": "image", "url": "https://..." }
--                 { "kind": "youtube", "video_id": "XXXXXXXXXXX" }
-- image_url остаётся как «обложка» для совместимости с OrdersClient / AdminOrdersClient / CategoryBreakdownChart.
-- Server Action синхронизирует image_url = первый элемент kind='image' из media.

ALTER TABLE shop_products
  ADD COLUMN IF NOT EXISTS media jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE shop_products
  DROP CONSTRAINT IF EXISTS shop_products_media_is_array;

ALTER TABLE shop_products
  ADD CONSTRAINT shop_products_media_is_array
  CHECK (jsonb_typeof(media) = 'array');

-- Backfill: существующие image_url -> первый элемент media (только если media пустой)
UPDATE shop_products
   SET media = jsonb_build_array(
         jsonb_build_object('kind', 'image', 'url', image_url)
       )
 WHERE image_url IS NOT NULL
   AND (media IS NULL OR media = '[]'::jsonb);
