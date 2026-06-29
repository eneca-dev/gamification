# Цена без скидки (discount_percent)

## Цель

Добавить к товарам возможность отображать «зачёркнутую» цену без скидки.
Администратор задаёт процент наценки над реальной ценой — система вычисляет цену без скидки и отображает её пользователю как «оригинальную» цену, подчёркивая выгоду покупки.

**Бизнес-логика:**
- `price_without_discount = round(real_price × (1 + discount_percent / 100))` — зачёркнутая цена
- `displayed_discount = round(dp / (100 + dp) × 100)`% — бейдж скидки для пользователя (считается от `discount_percent` напрямую, не от округлённых цен — избегаем дрейфа)
- `real_price` — цена продажи (не меняется: `round(cost_byn × coefficient × rate)`)
- `discount_percent = null` — скидки нет, отображение без изменений

## Этапы реализации

### Этап 1: БД + Типы + Action + Query

**Описание:**
Добавить колонку в БД, обновить тип `ShopProduct`, добавить утилиты расчёта, добавить поле в action обновления товара.

**Затрагиваемые файлы:**
- `supabase/migrations/0XX_product_discount_percent.sql` — новый файл
- `src/modules/shop/types.ts` — поле в типе + Zod-схема + две утилиты
- `src/modules/shop/actions.ts` — `discount_percent` в Zod-схеме update + UPDATE-запрос + `revalidateTag('shop-products')`

**Детали миграции:**
```sql
ALTER TABLE public.shop_products
  ADD COLUMN discount_percent integer NULL
  CONSTRAINT discount_percent_check CHECK (discount_percent > 0 AND discount_percent <= 500);
```

**Утилиты** (рядом с `computePriceCrystals`):
```ts
// Зачёркнутая цена в кристаллах
computePriceWithoutDiscount(priceInCrystals: number, discountPercent: number): number
  → Math.round(priceInCrystals * (1 + discountPercent / 100))

// Процент скидки для бейджа — считается от discountPercent напрямую, не от цен
// Формула: dp / (100 + dp), избегает дрейфа при округлении кристаллов
computeDisplayDiscount(discountPercent: number): number
  → Math.round((discountPercent / (100 + discountPercent)) * 100)
```

**Zod в action:**
```ts
discount_percent: z.number().int().min(1).max(500).nullable().optional()
```

После мутации: `revalidateTag('shop-products')` (кэш продуктов живёт 1 час, без этого изменение не появится).

SELECT не нужно трогать — запросы уже используют `select('*')`, колонка появится автоматически после миграции.

**Зависимости:** нет, первый этап.

---

### Этап 2: Админка — поле и колонка

**Описание:**
В ProductsClient добавить инлайн-редактирование `discount_percent`, колонку с отображением наценки и итоговой зачёркнутой цены, два фильтра. В ProductFormModal — поле с live-preview.

**Затрагиваемые файлы:**
- `src/modules/admin/components/ProductsClient.tsx`
- `src/modules/shop/components/ProductFormModal.tsx`

**Детали ProductsClient:**
- Колонка «Скидка»: `+X%` и зачёркнутая цена в кристаллах (вычислено через `computePriceWithoutDiscount`, read-only серым)
- Инлайн-ввод: по аналогии с `cost_byn` / `coefficient` — числовое поле, Enter = сохранить, Esc = отменить, пустое значение = `null` (убрать скидку)
- Фильтры: `скидка:есть` / `скидка:нет` (числовые операторы не нужны)

**Детали ProductFormModal:**
- Поле `Наценка %` — число, опциональное, кнопка очистки (×)
- Live-preview под полем: «Цена без скидки: N кристаллов (−X% для покупателя)»

**Зависимости:** Этап 1 (нужен action с поддержкой поля + тип с колонкой).

---

### Этап 3: Пользовательская карточка товара

**Описание:**
В ProductCard добавить отображение зачёркнутой цены и бейджа скидки когда `discount_percent != null`.

**Затрагиваемые файлы:**
- `src/modules/shop/components/ProductCard.tsx`

**Детали:**
- `discount_percent != null`: над реальной ценой — зачёркнутая `price_without_discount` + бейдж «−X%»
- Бейдж использует CSS-переменные из дизайн-системы, без хардкода цветов
- `discount_percent == null`: без изменений
- Обе утилиты берутся из `src/modules/shop/types.ts`, формулы не дублируются

**Зависимости:** Этап 1 (утилиты + поле в данных из query).

---

### Этап 4: Документация

**Описание:**
Обновить `src/docs/shop.md` — добавить описание поля `discount_percent`, логику расчёта, поведение в UI и в admin.

**Затрагиваемые файлы:**
- `src/docs/shop.md`

**Зависимости:** Все этапы завершены.

---

## Критерии готовности

- [ ] Колонка `discount_percent` в БД, constraint `> 0 AND <= 500` работает
- [ ] Тип `ShopProduct` содержит `discount_percent: number | null`
- [ ] Утилиты `computePriceWithoutDiscount` и `computeDisplayDiscount(dp)` в `types.ts`, нигде не дублируются
- [ ] Action принимает `discount_percent`, валидирует через Zod, вызывает `revalidateTag('shop-products')`
- [ ] Инлайн-редактирование в таблице ProductsClient работает, пустое значение = null
- [ ] Колонка «Скидка» в ProductsClient отображает `+X%` и зачёркнутую цену
- [ ] Фильтры `скидка:есть` / `скидка:нет` работают
- [ ] Поле в ProductFormModal с live-preview работает
- [ ] Пользователь видит зачёркнутую цену и бейдж при `discount_percent != null`
- [ ] При `discount_percent = null` UI пользователя без изменений
- [ ] `npm run build` и `npm run lint` — без ошибок
- [ ] `src/docs/shop.md` обновлён
