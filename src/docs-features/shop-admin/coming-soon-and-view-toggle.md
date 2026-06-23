# Статус "Скоро в продаже" и переключение вида в /admin/products

## Цель

Добавить в магазин третье состояние товара — «Скоро в продаже»: товар виден пользователям, но купить его нельзя. Администратор управляет статусом через новый 3-состоятельный дропдаун вместо бинарного тоггла.

Параллельно добавить переключение вида в `/admin/products`: таблица (текущий вид) ↔ карточки (сетка).

---

## Модель статусов товара

| Состояние          | `is_active` | `is_coming_soon` | Видим пользователю | Купить |
|--------------------|-------------|------------------|--------------------|--------|
| Активен            | `true`      | `false`          | ✅                 | ✅     |
| Скоро в продаже    | `false`     | `true`           | ✅ (с бейджем)     | ❌     |
| Неактивен          | `false`     | `false`          | ❌                 | ❌     |

Поля взаимоисключающие: `is_active = true` и `is_coming_soon = true` одновременно невозможны.

---

## Этапы реализации

### Этап 1: Миграция БД

**Файл:** `supabase/migrations/077_product_coming_soon.sql`

- Добавить колонку `is_coming_soon boolean NOT NULL DEFAULT false` в `shop_products`
- Добавить CHECK constraint: `CHECK (NOT (is_active AND is_coming_soon))`

Зависимости: нет, выполняется первым.

---

### Этап 2: Бэкенд — типы и queries

**Затрагиваемые файлы:**
- `src/modules/shop/types.ts`
- `src/modules/shop/queries.ts`

**Изменения:**

`types.ts`:
- Добавить `is_coming_soon: boolean` в интерфейс `ShopProduct`
- Добавить `is_coming_soon: z.boolean().optional()` в `updateProductSchema`

`queries.ts`:
- В `_getProducts()` изменить фильтр с `.eq('is_active', true)` на `.or('is_active.eq.true,is_coming_soon.eq.true')` — чтобы "скоро в продаже" попадали в пользовательский магазин
- `getAllProducts()` не трогать — он уже возвращает все товары без фильтра (для админки)

Зависимости: Этап 1 (колонка должна существовать в БД).

---

### Этап 3: Пользовательский UI

**Затрагиваемые файлы:**
- `src/modules/shop/components/ProductCard.tsx`
- `src/modules/shop/components/PurchaseButton.tsx`

**Изменения:**

`PurchaseButton.tsx`:
- Добавить проп `comingSoon?: boolean`
- Если `comingSoon = true` — кнопка заблокирована, текст «Скоро в продаже»

`ProductCard.tsx`:
- Если `product.is_coming_soon` — показывать бейдж «Скоро в продаже» поверх изображения (в той же позиции, что «Нет в наличии»)
- Передавать `comingSoon={product.is_coming_soon}` в `PurchaseButton`

Edge-cases:
- Товар `is_coming_soon = true` с `is_countable = true` и `stock = 0` — бейдж «Скоро в продаже» имеет приоритет над «Нет в наличии»

Зависимости: Этап 2 (тип `ShopProduct` уже содержит `is_coming_soon`).

---

### Этап 4: Админский UI

**Затрагиваемый файл:** `src/modules/admin/components/ProductsClient.tsx`

**Изменения:**

**4.1 — 3-состоятельный статус товара:**
- Добавить `is_coming_soon` в `ShopProductWithCategory` (приходит из типа — уже будет после Этапа 2)
- Заменить `ToggleSwitch` в колонке «Статус» на новый компонент `ProductStatusDropdown` (локальный, в том же файле)
- `ProductStatusDropdown` принимает текущий статус и вызывает коллбэк с новым
- Логика смены статуса в `setProductStatus(product, newStatus)`:
  - `'active'` → `{ is_active: true, is_coming_soon: false }`
  - `'coming_soon'` → `{ is_active: false, is_coming_soon: true }`
  - `'inactive'` → `{ is_active: false, is_coming_soon: false }`
- Optimistic update + откат при ошибке (по тому же паттерну, что `toggleProductActive`)
- Ограничение: нельзя поставить «Активен» если `is_countable && stock === 0` (текущая бизнес-логика сохраняется)

**4.2 — Переключение вида (список / карточки):**
- Добавить `viewMode: 'list' | 'cards'` в локальный стейт
- В заголовке секции «Товары» добавить 2 кнопки-иконки (List / LayoutGrid из lucide-react)
- При `viewMode === 'cards'` рендерить сетку вместо таблицы:
  - `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-5`
  - Каждая карточка: изображение/эмодзи, название, категория-тег, цена, статус-дропдаун, кнопки редактировать/удалить
  - Карточки поддерживают те же действия (редактирование через модал, удаление с подтверждением, смена статуса)
- При `viewMode === 'list'` — текущая таблица без изменений

Зависимости: Этапы 1–2 (тип содержит `is_coming_soon`, actions принимают поле).

---

## Критерии готовности

- [ ] Миграция применена, колонка `is_coming_soon` существует в `shop_products`
- [ ] Товар со статусом «Скоро в продаже» отображается в пользовательском магазине с бейджем
- [ ] Кнопка покупки для «Скоро в продаже» заблокирована
- [ ] Неактивные товары (`is_active = false, is_coming_soon = false`) не видны пользователям
- [ ] В `/admin/products` статус-дропдаун показывает 3 варианта и корректно переключает
- [ ] Optimistic update и откат при ошибке работают для смены статуса
- [ ] Переключение вида (таблица / карточки) работает, все действия доступны в обоих видах
- [ ] `npm run build` и `npm run lint` проходят без ошибок
