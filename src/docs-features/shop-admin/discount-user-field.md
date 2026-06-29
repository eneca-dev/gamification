# Скидка юзера вместо наценки

## Цель

Изменить семантику поля `discount_percent` в таблице `shop_products`: вместо наценки (markup, 1–500) хранить напрямую процент скидки для пользователя (1–99). Убрать поле "Наценка" из UI — admin вводит скидку юзера, она же и сохраняется в БД.

## Контекст и мотивация

Сейчас `discount_percent` хранит наценку (markup). Например, значение `50` означает: зачёркнутая цена = реальная × 1.5, пользователь видит −33%. UI конвертирует туда-обратно. Это запутанно: поле называется `discount_percent`, а хранит markup.

После изменения: значение `33` = пользователь видит −33%, зачёркнутая цена = реальная / 0.67.

## Затрагиваемые файлы

- `supabase/migrations/<timestamp>_discount_percent_semantic.sql`
- `src/modules/shop/types.ts`
- `src/modules/admin/components/ProductFormModal.tsx`
- `src/modules/admin/components/ProductsClient.tsx`

## Этапы реализации

### Этап 1: Миграция БД

**Описание:**
1. Конвертировать существующие значения: `markup → userDiscount = ROUND(markup / (100 + markup) * 100)`
2. Добавить CHECK constraint: `discount_percent BETWEEN 1 AND 99`

**Данные до/после:**
| Товар | Было (markup) | Станет (скидка юзера) |
|---|---|---|
| Ланч-бокс | 50 | 33 |
| Куртки | 6 | 6 |
| Сертификат в кофейню | 50 | 33 |
| Увлажнитель воздуха | 5 | 5 |

**SQL:**
```sql
UPDATE shop_products
SET discount_percent = ROUND(discount_percent::float / (100 + discount_percent::float) * 100)
WHERE discount_percent IS NOT NULL;

ALTER TABLE shop_products
ADD CONSTRAINT shop_products_discount_percent_check
CHECK (discount_percent IS NULL OR discount_percent BETWEEN 1 AND 99);
```

**Зависимости:** нет, выполняется первым.

---

### Этап 2: Обновление типов и формул (`types.ts`)

**Описание:**
- Zod-схема: `z.number().int().min(1).max(500)` → `max(99)`
- `computePriceWithoutDiscount(price, userDiscount)`:
  - Было: `Math.round(price * (1 + d / 100))` — умножение на (1 + markup)
  - Станет: `Math.round(price / (1 - d / 100))` — деление на (1 − скидка)
- `computeDisplayDiscount(userDiscount)`:
  - Было: `Math.round(d / (100 + d) * 100)` — пересчёт markup → %
  - Станет: `return d` — значение уже и есть скидка юзера
  - Функция остаётся в экспорте чтобы не трогать вызывающий код

**Затрагиваемые файлы:** `src/modules/shop/types.ts`

**Зависимости:** Этап 1.

---

### Этап 3: UI — ProductFormModal

**Описание:**
- Удалить state `discountPercent` (markup) — форма теперь работает только с `userDiscountPercent`
- Удалить функцию `handleMarkupChange`
- Упростить `handleUserDiscountChange` — больше не нужно пересчитывать markup
- Удалить поле "Наценка %" из формы, убрать `grid-cols-2`
- Переименовать лейбл: `"Скидка для юзера % (от зачёркнутой)"` → `"Скидка %"`
- В `handleSubmit`: `discount_percent: parseInt(userDiscountPercent, 10)` напрямую
- Инициализация при редактировании: `userDiscountPercent = String(product.discount_percent)` (без конвертации)

**Затрагиваемые файлы:** `src/modules/admin/components/ProductFormModal.tsx`

**Зависимости:** Этап 2.

---

### Этап 4: UI — ProductsClient

**Описание:**
- Заголовок таблицы: `'Скидка юзера / Наценка'` + HelpCircle tooltip → `'Скидка'`
- В таблице (display ячейки): убрать строку `наценка +{product.discount_percent}%`
- В карточках: убрать строку `наценка +{product.discount_percent}%`
- `startInlineEdit` для `discount_percent`: убрать конвертацию markup→userDiscount, `value = String(product.discount_percent)` напрямую
- `saveInlineEdit` для `discount_percent`: валидация `1–99`, сообщение `"Скидка должна быть от 1 до 99%"`
- `InlineDualDiscountInput`: убрать строку с инпутом "Наценка", оставить только "Скидка %", `autoFocus` на него

**Затрагиваемые файлы:** `src/modules/admin/components/ProductsClient.tsx`

**Зависимости:** Этап 2.

---

## Критерии готовности

- [ ] Миграция применена, данные конвертированы корректно
- [ ] CHECK constraint на диапазон 1–99 работает
- [ ] В форме товара одно поле скидки, вводимое значение сохраняется в БД как есть
- [ ] В таблице и карточках нет упоминания "наценки"
- [ ] Инлайн-редактирование скидки работает: одно поле, валидация 1–99
- [ ] Превью цены в форме показывает правильную зачёркнутую цену
- [ ] `npm run build` без ошибок
