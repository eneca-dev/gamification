# Флаг `is_countable` для категорий магазина

## Цель

Отвязать учёт остатков (`stock`) от флага `is_physical`. Сейчас `is_physical = true` автоматически означает обязательный `stock`. Но еда — физический товар (заказ `pending`, выдаёт админ), при этом остатки не ограничены. Нужен отдельный флаг `is_countable`, определяющий, ведётся ли учёт остатков для товаров категории.

## Текущее поведение

| Флаг | `is_physical = true` | `is_physical = false` |
|------|----------------------|-----------------------|
| Статус заказа | `pending` (ждёт админа) | `fulfilled` (сразу) |
| Stock | обязателен, `stock -= 1` при покупке | `NULL` (безлимит) |
| UI остатка | показывается, inline-редактируемый | `∞`, скрыт |

## Целевое поведение

Два независимых флага на категории:

| Флаг | Что определяет |
|------|----------------|
| `is_physical` | Статус заказа: `pending` (физ.) vs `fulfilled` (цифр.) |
| `is_countable` | Учёт остатков: `stock` обязателен (да) vs `stock = NULL` (нет, `∞`) |

Матрица:

| `is_physical` | `is_countable` | Пример | Заказ | Stock |
|---|---|---|---|---|
| true | true | Мерч, Техника | `pending` | обязателен |
| true | false | Еда, кофе | `pending` | `NULL` (∞) |
| false | true | — (пока нет кейса) | `fulfilled` | обязателен |
| false | false | Артефакты, Розыгрыши | `fulfilled` | `NULL` (∞) |

## Этапы реализации

### Этап 1: Миграция БД + SQL-функции

**Затрагиваемые объекты:**
- Таблица `shop_categories` — новая колонка `is_countable boolean DEFAULT true NOT NULL`
- SQL-функция `purchase_product` — заменить `is_physical` на `is_countable` в логике stock
- SQL-функция `cancel_order` — заменить `is_physical` на `is_countable` в логике возврата stock

**Миграция:**

```sql
-- 1. Добавляем колонку
ALTER TABLE shop_categories ADD COLUMN is_countable boolean NOT NULL DEFAULT true;

-- 2. Проставляем значения на основе is_physical
-- Физические → is_countable = true (по умолчанию, совпадает)
-- Нефизические → is_countable = false
UPDATE shop_categories SET is_countable = is_physical;
```

**Изменения в `purchase_product`:**
- Шаг 1: добавить `c.is_countable` в SELECT
- Проверка stock: заменить `IF v_is_physical AND v_stock IS NOT NULL AND v_stock = 0` → `IF v_is_countable AND v_stock IS NOT NULL AND v_stock = 0`
- Шаг 8: заменить `IF v_is_physical AND v_stock IS NOT NULL` → `IF v_is_countable AND v_stock IS NOT NULL`

**Изменения в `cancel_order`:**
- Шаг 0: заменить `c.is_physical` → `c.is_countable` (переименовать переменную в `v_is_countable`)
- Шаг 6: заменить `IF v_is_physical` → `IF v_is_countable`

**Зависимости:** нет (первый этап)

---

### Этап 2: Типы и Zod-схемы

**Затрагиваемые файлы:**
- `src/modules/shop/types.ts` — `ShopCategory`, `ShopProductWithCategory`, Zod-схемы
- `src/modules/admin/types.ts` — если `is_countable` нужен в admin types

**Изменения:**

1. `ShopCategory` — добавить `is_countable: boolean`
2. `ShopProductWithCategory.category` — добавить `is_countable` в Pick
3. `createCategorySchema` — добавить `is_countable: z.boolean()`
4. `updateCategorySchema` — добавить `is_countable: z.boolean().optional()`

**Зависимости:** Этап 1 (колонка должна существовать)

---

### Этап 3: Queries — добавить `is_countable` в выборки

**Затрагиваемые файлы:**
- `src/modules/shop/queries.ts` — `getProducts`, `getAllProducts`, `getProductById`
- `src/modules/admin/queries.ts` — `getOrders`

**Изменения:**

Везде, где в select-строке фигурирует `is_physical` из `shop_categories`, добавить `is_countable`:
- `category:shop_categories!category_id ( name, slug, is_physical, is_countable, is_active )`

В `getOrders` — добавить `is_countable` в data transformation рядом с `is_physical`.

**Зависимости:** Этап 2 (типы должны быть обновлены)

---

### Этап 4: Админка — UI категорий и товаров

**Затрагиваемые файлы:**
- `src/modules/admin/components/ProductsClient.tsx` — таблица категорий + таблица товаров
- `src/modules/admin/components/ProductFormModal.tsx` — форма создания/редактирования товара

**Изменения в таблице категорий (`ProductsClient.tsx`):**

1. Добавить колонку «Исчисляемый» в таблицу категорий (между «Тип» и «Статус»)
2. Рендерить как тоггл `ToggleSwitch` (аналогично статусу)
3. При создании категории — добавить чекбокс «Исчисляемый товар» (по умолчанию `true` для физических, `false` для цифровых)
4. Форма создания: связать дефолт `is_countable` с `is_physical` (при переключении типа автоматически обновлять)

**Изменения в таблице товаров (`ProductsClient.tsx`):**

Заменить `product.category?.is_physical` на `product.category?.is_countable` в:
- Колонке «Остаток» — показывать inline-редактирование stock только для `is_countable`
- Символ `∞` — показывать для `!is_countable`

**Изменения в `ProductFormModal.tsx`:**

Заменить `isPhysical` на `isCountable`:
- `const isCountable = selectedCategory?.is_countable ?? false`
- Показывать/скрывать поле stock по `isCountable`
- Валидация stock: `if (isCountable && stock === '') errs.stock = 'Укажите количество'`
- Результат: `stock: isCountable ? parseInt(stock, 10) : null`

**Зависимости:** Этапы 2-3

---

### Этап 5: Магазин — карточки товаров

**Затрагиваемые файлы:**
- `src/modules/shop/components/ProductCard.tsx`

**Изменения:**

Заменить `product.category.is_physical` на `product.category.is_countable` в:
- `outOfStock` — `product.category.is_countable && product.stock !== null && product.stock === 0`
- Бейдж «Осталось: N» — `product.category.is_countable && product.stock !== null && product.stock > 0 && product.stock <= 5`

**Зависимости:** Этапы 2-3

---

### Этап 6: Заказы — логика отображения

**Затрагиваемые файлы:**
- `src/modules/admin/components/AdminOrdersClient.tsx` — если `is_physical` используется для stock-связанной логики

**Проверить:** `is_physical` в заказах определяет статус и UI дропдауна — это НЕ меняется (статус заказа зависит от `is_physical`). `is_countable` на заказы не влияет.

**Изменения:** нет (заказы работают с `is_physical`, не с `is_countable`)

**Зависимости:** нет

---

### Этап 7: Документация

**Затрагиваемые файлы:**
- `src/docs/shop.md`
- `src/docs/admin.md`
- `src/docs/gamification-db.md`
- `src/docs-features/shop-admin/plan.md`

**Изменения:**
- Описать `is_countable` в схеме `shop_categories`
- Обновить правила stock: зависят от `is_countable`, не от `is_physical`
- Обновить типы: `ShopCategory`, `ShopProductWithCategory`
- Обновить описание `purchase_product` и `cancel_order`

**Зависимости:** все предыдущие этапы

---

## Критерии готовности

- [ ] Колонка `is_countable` добавлена в `shop_categories`
- [ ] Существующие категории имеют корректные значения `is_countable`
- [ ] SQL-функции `purchase_product` и `cancel_order` используют `is_countable` для stock-логики
- [ ] Типы и Zod-схемы обновлены
- [ ] Queries возвращают `is_countable`
- [ ] Админка: категории — колонка/тоггл `is_countable`, форма товара — stock по `is_countable`
- [ ] Магазин: карточки товаров — бейджи stock по `is_countable`
- [ ] Заказы: поведение НЕ изменилось (статус зависит от `is_physical`)
- [ ] `npm run build` проходит
- [ ] Документация обновлена
