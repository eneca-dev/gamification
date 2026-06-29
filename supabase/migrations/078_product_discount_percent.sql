-- Добавляет поле discount_percent к товарам магазина.
-- Задаётся администратором как наценка в % над реальной ценой.
-- Используется для отображения зачёркнутой "цены без скидки" пользователю.
-- NULL = скидки нет. Диапазон 1..500.

ALTER TABLE public.shop_products
  ADD COLUMN discount_percent integer NULL
  CONSTRAINT shop_products_discount_percent_check CHECK (discount_percent > 0 AND discount_percent <= 500);
