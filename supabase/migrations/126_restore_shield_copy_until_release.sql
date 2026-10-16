-- Пока веб-код не выпущен, рабочий Магазин всё ещё разрешает покупку
-- только при pending. Возвращаем соответствующий текст до выпуска.
UPDATE public.shop_products
SET description = 'Спасает стрик Worksection при красном дне. Можно купить только в течение 24 часов после красного дня.',
    updated_at = now()
WHERE effect = 'streak_shield_ws';

UPDATE public.shop_products
SET description = 'Спасает стрик Revit при пропуске использования плагинов. Можно купить только в течение 24 часов после пропуска.',
    updated_at = now()
WHERE effect = 'streak_shield_revit';
