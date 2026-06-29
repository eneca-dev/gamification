-- Add coming soon status to shop products
ALTER TABLE shop_products
  ADD COLUMN is_coming_soon boolean NOT NULL DEFAULT false;

ALTER TABLE shop_products
  ADD CONSTRAINT check_active_coming_soon_exclusive
  CHECK (NOT (is_active AND is_coming_soon));
