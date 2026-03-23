# Магазин + Админ-панель

## Цель

Создать полноценный магазин, где сотрудники обменивают коины на товары (артефакты, мерч, техника, розыгрыши), и админ-панель для управления системой геймификации: товары, заказы, события, пользователи, роли.

---

## Текущее состояние

- Страницы `/store` и `/admin` существуют на **мок-данных** из `src/lib/data.ts`
- Модулей `shop`, `admin` в `src/modules/` нет
- Таблиц для магазина в БД нет
- Системы ролей нет
- `second_life_cost` **нужно удалить** из `gamification_event_types` (0 транзакций, legacy) + обновить `gamification-db.md` и `gamification-events.md`

---

## Архитектура

### 1. Роли и доступ

**Решение: `is_admin boolean DEFAULT false` в таблице `ws_users`.**

Обоснование:
- `ws_users` — центральная таблица, на неё завязана вся геймификация
- Нужна ровно одна роль — «админ»
- RLS-политики проще: `COALESCE((auth.jwt() -> 'is_admin')::boolean, false)`
- Если потребуются новые роли — несложно мигрировать на отдельную таблицу

Первый админ назначается вручную в БД:
```sql
UPDATE ws_users SET is_admin = true WHERE email = 'admin@example.com';
```

Админы могут назначать новых админов через UI.

**Защита админки:**
- Middleware проверяет `is_admin` **из JWT** для роутов `/admin/*` (0 DB-запросов, UX-редирект)
- Server Actions админ-модуля проверяют `is_admin` **из JWT** перед каждой мутацией
- RLS-политики на таблицах магазина: INSERT/UPDATE/DELETE — только для `is_admin = true` (через `auth.jwt() -> 'is_admin'`)

**`is_admin` в JWT — Custom Access Token Hook:**

Supabase Auth Hook (pg-функция), которая добавляет `is_admin` и `ws_user_id` в JWT claims при каждом выпуске/рефреше токена:
```sql
CREATE OR REPLACE FUNCTION custom_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  _ws_user_id uuid;
  _is_admin boolean;
BEGIN
  SELECT id, is_admin INTO _ws_user_id, _is_admin
  FROM ws_users WHERE user_id = (event->>'user_id')::uuid;

  event := jsonb_set(event, '{claims,is_admin}', COALESCE(to_jsonb(_is_admin), 'false'::jsonb));
  event := jsonb_set(event, '{claims,ws_user_id}', COALESCE(to_jsonb(_ws_user_id), 'null'::jsonb));
  RETURN event;
END;
$$;
```

- **Middleware** и **Server Actions** читают `is_admin` из JWT — быстро, без DB hit
- **Задержка**: до ~1 часа после `toggleAdmin` (пока JWT обновится). Приемлемо для корпоративного приложения — админов назначают крайне редко
- **UX**: в UI `toggleAdmin` показывать уведомление «Новому админу нужно перелогиниться, чтобы увидеть админ-панель»

**✅ Решение:** `is_admin` в `ws_users` + JWT Custom Access Token Hook (`is_admin`, `ws_user_id`) для всего приложения (middleware, Server Actions, AuthUser).

---

### 2. Таблицы БД

#### `shop_categories` — категории товаров

Управляются админами через UI. Предзаполняются миграцией.

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | |
| `name` | text UNIQUE | Отображаемое название («Мерч», «Техника», «Артефакты», «Розыгрыши») |
| `slug` | text UNIQUE | Машинное имя для URL-фильтрации (`/store?category=merch`). Не FK — связь через `id` |
| `description` | text NULL | Подпись для UI (например, «Товары переходят в собственность сотрудника») |
| `is_physical` | boolean DEFAULT false | Физический товар? Определяет поведение при покупке и доступность поля `stock` |
| `sort_order` | integer DEFAULT 0 | Порядок в фильтрах |
| `is_active` | boolean DEFAULT true | Показывать ли категорию в магазине |
| `created_at` | timestamptz | |

**Флаг `is_physical` определяет:**
- **При покупке:** `is_physical = true` → заказ `pending` (ждёт обработки админом). `is_physical = false` → заказ сразу `fulfilled`.
- **При создании товара:** `is_physical = true` → админ **обязан** указать `stock` (количество). `is_physical = false` → поле `stock` недоступно, товар безлимитный (`stock = NULL`).
- **В UI админки:** для нефизических категорий поле «Количество» скрыто/заблокировано.

Начальные данные (seed в миграции):
| name | slug | is_physical | description |
|---|---|---|---|
| Артефакты | `artifact` | false | Системные эффекты геймификации |
| Мерч | `merch` | true | Переходят в собственность сотрудника |
| Техника | `upgrade` | true | Остаётся собственностью компании |
| Розыгрыши | `raffle` | false | Билеты на участие в розыгрышах |

Админ может:
- Создавать новые категории (name, slug, description, is_physical, sort_order)
- Редактировать существующую категорию
- Деактивировать категорию (`is_active = false`) — не удалять, чтобы не ломать FK товаров

**Деактивация категории с pending заказами:**
- При деактивации UI показывает кол-во `pending`/`processing` заказов в этой категории
- Деактивация не блокируется — админ может деактивировать даже с активными заказами
- Существующие заказы (`pending`, `processing`) остаются доступными для обработки в админке
- Новые покупки товаров этой категории заблокированы (фильтр `c.is_active = true` в магазине)

#### `shop_products` — каталог товаров

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | Название товара |
| `description` | text NULL | Описание для карточки |
| `price` | integer CHECK > 0 | Цена в коинах |
| `category_id` | uuid → shop_categories | Категория товара |
| `image_url` | text NULL | URL картинки |
| `emoji` | text NULL | Эмодзи для карточки (пока нет картинок) |
| `is_active` | boolean DEFAULT true | Показывать ли в магазине |
| `stock` | integer NULL CHECK (stock >= 0) | Остаток. NULL = безлимит (нефизические). Обязателен для физических товаров |
| `sort_order` | integer DEFAULT 0 | Порядок сортировки |
| `created_by` | uuid → ws_users | Кто из админов создал |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Обновлять явно в `updateProduct` action: `updated_at = now()` |

**Правила `stock`:**
- Категория `is_physical = true` → `stock` обязателен (NOT NULL на уровне Server Action, не БД — чтобы не усложнять constraint кросс-таблицей)
- Категория `is_physical = false` → `stock = NULL` (безлимит), поле скрыто в UI
- При покупке: `stock -= 1` (только если `stock IS NOT NULL`)
- При отмене заказа: `stock += 1` (только если `stock IS NOT NULL`)
- Если `stock = 0` → товар нельзя купить (кнопка «Нет в наличии»)

#### `shop_orders` — заказы/покупки

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid → ws_users | Покупатель |
| `product_id` | uuid → shop_products | Что купил |
| `status` | text CHECK | `pending` / `processing` / `fulfilled` / `cancelled` |
| `status_changed_by` | uuid NULL → ws_users | Какой админ изменил статус |
| `status_changed_at` | timestamptz NULL | |
| `transaction_id` | uuid UNIQUE → gamification_transactions | Связь с финансовой транзакцией (1:1) |
| `refund_transaction_id` | uuid NULL UNIQUE → gamification_transactions | Связь с транзакцией возврата (при отмене) |
| `note` | text NULL | Комментарий админа |
| `created_at` | timestamptz | |

**Сумма списания не дублируется** — берётся через JOIN на `transaction_id`:
`gamification_transactions.coins` (отрицательное число при покупке). Связь 1:1, JOIN на PK — мгновенный.

**Статусы заказов** — CHECK constraint + TypeScript union + Zod enum:
- `pending` — куплено, ожидает обработки (физические товары)
- `processing` — админ взял в работу
- `fulfilled` — выполнено (автоматически для нефизических при покупке)
- `cancelled` — отменено админом (коины возвращены)

**✅ Решение:** статусов достаточно. Типизация: CHECK в БД, `OrderStatus` union type + `z.enum()` в TypeScript. Переходы между статусами не ограничиваются — админ может выставить любой допустимый статус (кроме `cancelled` — через `cancelOrder` с возвратом).

**Возврат при отмене — да, с `shop_refund`:**
- При отмене заказа коины возвращаются пользователю
- Сумма возврата = `ABS(gamification_transactions.coins)` по `transaction_id`
- Кому вернуть = `shop_orders.user_id`
- Транзакция возврата записывается в `refund_transaction_id`

#### Изменения в существующих таблицах

**`ws_users`** — добавить колонку:
| Колонка | Тип | Описание |
|---|---|---|
| `is_admin` | boolean DEFAULT false | Флаг администратора. **Не трогается VPS-синком** `sync-ws-users` (добавить в список исключений наряду с `user_id` и `department_code`) |

**`gamification_event_types`** — добавить колонку и записи:

Новая колонка:
| Колонка | Тип | Описание |
|---|---|---|
| `is_dynamic_coins` | boolean DEFAULT false | Сумма определяется при создании транзакции, а не из этой таблицы |

Новые записи:
| key | coins | is_dynamic_coins | description |
|---|---|---|---|
| `shop_purchase` | 0 | true | Покупка в магазине (сумма = цена товара) |
| `shop_refund` | 0 | true | Возврат за отменённый заказ (сумма = цена покупки) |

**Как работает `is_dynamic_coins`:**
- `false` (по умолчанию, все существующие события) — сумма фиксированная, берётся из `coins`. Админ может менять `coins` через UI.
- `true` (shop_purchase, shop_refund) — сумма определяется при создании транзакции (цена товара). `coins` в таблице = 0 как заглушка, не используется. В админке поле «Стоимость» заблокировано, показывает «Определяется при покупке».

Существующие триггеры и скрипты не затронуты — они работают только с `is_dynamic_coins = false` событиями и читают `coins` как раньше.

#### RLS-политики на таблицах магазина

**`shop_categories`:**
- SELECT: все аутентифицированные (`auth.role() = 'authenticated'`)
- INSERT/UPDATE: только админы (`COALESCE((auth.jwt() -> 'is_admin')::boolean, false)`)
- DELETE: запрещён (деактивация вместо удаления)

**`shop_products`:**
- SELECT: все аутентифицированные
- INSERT/UPDATE: только админы
- DELETE: запрещён

**`shop_orders`:**
- SELECT: пользователь видит **только свои** (`user_id = my_ws_user_id()`), админ видит **все**
- INSERT: только service_role (через SQL-функцию `purchase_product`)
- UPDATE: service_role (через SQL-функцию `cancel_order`) + админы (через `updateOrderStatus` Server Action с обычным supabase-клиентом)
- DELETE: запрещён

**Существующие таблицы** (`gamification_event_logs`, `gamification_transactions`, `gamification_balances`):
- Без изменений — остаётся `service_role` only. Запись через SQL-функции, вызываемые из Server Actions через `supabaseAdmin`

---

### 3. Механика покупки

**Паттерн вызова:** Server Action → `supabaseAdmin.rpc('purchase_product', params)`.
SQL-функция `SECURITY INVOKER`, вызывается через service_role (обходит RLS штатно). `user_id` передаётся параметром из JWT (Server Action — доверенный серверный код).

```
Юзер нажимает «Купить»
  │
  ▼
Server Action purchaseProduct(productId):
  A. getCurrentUser() из JWT → получаем wsUserId (ws_users.id)
     → если не найден → ошибка «Пользователь не найден в системе»
  B. supabaseAdmin.rpc('purchase_product', { p_product_id, p_user_id: wsUserId })
  C. revalidatePath / revalidateTag

SQL-функция purchase_product(p_product_id, p_user_id) — SECURITY INVOKER, атомарная:
  0. SELECT email INTO v_user_email FROM ws_users WHERE id = p_user_id
     → если не найден → ошибка
  1. SELECT p.price, p.is_active, p.stock, p.name, c.is_physical
     FROM shop_products p JOIN shop_categories c ON p.category_id = c.id
     WHERE p.id = p_product_id
     FOR UPDATE OF p  -- блокируем строку товара от конкурентных покупок
     → если !is_active OR !c.is_active → ошибка «Товар недоступен»
     → если is_physical AND stock = 0 → ошибка «Нет в наличии»
  2. SELECT total_coins FROM gamification_balances WHERE user_id = p_user_id FOR UPDATE
     → блокирует строку баланса до конца транзакции (защита от race condition)
     → если total_coins < price → ошибка «Недостаточно коинов»
  3. Генерируем order_id = gen_random_uuid()
  4. INSERT gamification_event_logs
     (user_id = p_user_id, user_email = v_user_email,
      event_type = 'shop_purchase', source = 'shop',
      event_date = CURRENT_DATE,
      details = { product_id, product_name, order_id },
      idempotency_key = 'shop_purchase_{order_id}')
  5. INSERT gamification_transactions (user_id = p_user_id, user_email = v_user_email, event_id, coins = -price)
  6. UPSERT gamification_balances (total_coins -= price)
  7. INSERT shop_orders WITH id = order_id
     (user_id = p_user_id, product_id,
      status = 'fulfilled' если !is_physical, иначе 'pending',
      transaction_id = id из шага 5)
  8. Если is_physical: UPDATE shop_products SET stock = stock - 1
```

**Нефизические товары** (is_physical = false) — автоматически `fulfilled`, безлимитные.
**Физические товары** (is_physical = true) — `pending`, ждут обработки админом, `stock` уменьшается.

---

### 4. Механика возврата (при отмене заказа)

**Кто может отменить:** только админ (`is_admin = true`).

**Какие заказы можно отменить:** любые, кроме уже отменённых (`cancelled`). В том числе `fulfilled` — на случай ошибки или возврата физического товара.

**Откуда берутся данные для возврата:**
- **Кому вернуть** — `shop_orders.user_id`
- **Сколько вернуть** — `ABS(gamification_transactions.coins)` через JOIN на `shop_orders.transaction_id`. При покупке `coins` записывается как отрицательное число (например, `-150`), при возврате берём абсолютное значение (`+150`)
- **Какой товар** — `shop_orders.product_id` (для возврата `stock`)
- **Физический ли** — JOIN `shop_products.category_id` → `shop_categories.is_physical` (для возврата `stock`)

**Связь заказа с транзакциями:**
```
shop_orders
  ├── transaction_id → gamification_transactions (покупка, coins = -150)
  └── refund_transaction_id → gamification_transactions (возврат, coins = +150)
```
Оба поля — UNIQUE FK на `gamification_transactions.id`. `refund_transaction_id` заполняется только при отмене, иначе NULL.

**Полный flow:**

**Паттерн вызова:** Server Action → `supabaseAdmin.rpc('cancel_order', params)`.
SQL-функция `SECURITY INVOKER`, вызывается через service_role. Проверка `is_admin` из JWT в Server Action.

```
Админ нажимает «Отменить заказ»
  │
  ▼
Server Action cancelOrder(orderId, note?):
  A. getCurrentUser() из JWT → проверяем isAdmin, получаем wsUserId
     → если !isAdmin → ошибка «Forbidden»
  B. supabaseAdmin.rpc('cancel_order', { p_order_id, p_admin_id: wsUserId, p_note })
  C. revalidatePath / revalidateTag

SQL-функция cancel_order(p_order_id, p_admin_id, p_note) — SECURITY INVOKER, атомарная:

  0. Читаем заказ + блокируем строку + данные для возврата + email покупателя:
     SELECT o.id, o.user_id, o.product_id, o.status,
            o.refund_transaction_id,
            ABS(t.coins) AS refund_amount,
            c.is_physical,
            w.email AS user_email
     FROM shop_orders o
     JOIN gamification_transactions t ON o.transaction_id = t.id
     JOIN shop_products p ON o.product_id = p.id
     JOIN shop_categories c ON p.category_id = c.id
     JOIN ws_users w ON o.user_id = w.id
     WHERE o.id = p_order_id
     FOR UPDATE OF o  -- блокируем строку заказа от конкурентных отмен

  1. Валидация:
     → не найден → ошибка «Заказ не найден»
     → o.status = 'cancelled' → ошибка «Заказ уже отменён»
     → o.refund_transaction_id IS NOT NULL → ошибка «Возврат уже выполнен»

  2. Записываем событие возврата:
     INSERT gamification_event_logs (
       user_id      = o.user_id,
       user_email   = user_email,
       event_type   = 'shop_refund',
       source       = 'shop',
       event_date   = CURRENT_DATE,
       details      = { order_id, product_id, reason: p_note },
       idempotency_key = 'shop_refund_{p_order_id}'
     )

  3. Записываем транзакцию возврата:
     INSERT gamification_transactions (
       user_id    = o.user_id,
       user_email = user_email,
       event_id   = id из шага 2,
       coins      = +refund_amount
     )

  4. Обновляем баланс:
     UPSERT gamification_balances
       SET total_coins = total_coins + refund_amount

  5. Обновляем заказ:
     UPDATE shop_orders SET
       status = 'cancelled',
       refund_transaction_id = id из шага 3,
       note = p_note,
       status_changed_by = p_admin_id,
       status_changed_at = now()

  6. Возвращаем stock (только физические):
     Если is_physical:
       UPDATE shop_products SET stock = stock + 1 WHERE id = o.product_id
```

**Idempotency:** ключ `shop_refund_{order_id}` — один заказ можно отменить только один раз. Повторный вызов `cancelOrder` с тем же `orderId` ничего не сделает (шаг 2 отсечёт по статусу `cancelled`).

**Что видит юзер после отмены:**
- В истории заказов: статус `cancelled`, комментарий админа
- В истории транзакций: две записи — покупка (`-150`) и возврат (`+150`)
- Баланс: восстановлен

**Что видит админ:**
- В таблице заказов: статус `cancelled`, кто отменил, когда, комментарий
- `refund_transaction_id` заполнен — можно проследить связь с транзакцией возврата

---

### 5. Управление событиями (gamification_event_types)

Админ может через UI:
- Просматривать все event types с текущими коинами
- Менять `coins` у событий с `is_dynamic_coins = false`
- У событий с `is_dynamic_coins = true` — поле заблокировано, показывает «Определяется при покупке»
- **Не может** добавлять/удалять event types (они создаются в миграциях, привязаны к логике триггеров и скриптов)

> **📌 На будущее:** логирование изменений стоимости событий (кто поменял, когда, было/стало). Не реализуется в текущей итерации.

---

### 6. Просмотр пользователей (админка)

Админ может:
- Видеть список всех сотрудников из `ws_users` (имя, email, отдел, баланс, is_admin)
- Фильтровать/искать по имени, отделу
- Кликнуть на сотрудника → увидеть:
  - Текущий баланс из `gamification_balances`
  - Историю транзакций из `view_user_transactions` (все начисления/списания)
  - Историю заказов из `shop_orders` (что покупал в магазине)
- Назначить/снять роль админа (toggle `is_admin`)

---

### 7. Управление заказами (админка)

Админ может:
- Видеть список всех заказов из `shop_orders` (JOIN с `ws_users` + `shop_products`)
- Фильтровать по статусу (`pending` / `processing` / `fulfilled` / `cancelled`)
- Менять статус заказа (любой допустимый, кроме `cancelled` — для отмены есть `cancelOrder`)
- Отменять заказ (с возвратом коинов)
- Оставлять комментарий (`note`)

---

### 8. Управление категориями (админка)

Админ может:
- Видеть список категорий из `shop_categories`
- Создавать новую категорию (name, slug, description, sort_order)
- Редактировать существующую категорию
- Деактивировать категорию (`is_active = false`) — не удалять, чтобы не ломать FK товаров

### 9. Управление товарами (админка)

Админ может:
- Видеть список всех товаров из `shop_products` (с названием категории через JOIN)
- Создавать новый товар (name, description, price, category_id, emoji/image_url, stock)
- Редактировать существующий товар
- Деактивировать товар (`is_active = false`) — не удалять, чтобы не ломать FK в заказах

**Деактивация товара с pending заказами:**
- При деактивации UI показывает кол-во `pending`/`processing` заказов на этот товар
- Деактивация не блокируется — существующие заказы обрабатываемы, новые покупки заблокированы
- Аналогично деактивации категории

**Картинки товаров — загрузка через Supabase Storage:**

Supabase Storage — S3-совместимое хранилище файлов, встроенное в Supabase.

**Bucket:** `product-images` (public — картинки товаров не секретные, доступны по прямому URL без токена).

**Путь файла в Storage:** `${productId}/${timestamp}_${filename}` — timestamp исключает коллизии имён при замене.

**Flow добавления картинки (создание/редактирование товара):**
```
Админ выбирает файл в форме товара
  │
  ▼
1. Client Component отправляет файл через supabase.storage
     .from('product-images')
     .upload(`${productId}/${timestamp}_${filename}`, file)
2. Получает публичный URL:
     supabase.storage.from('product-images').getPublicUrl(path)
3. URL сохраняется в shop_products.image_url через Server Action
```

**Flow замены картинки:**
```
Админ выбирает новый файл в форме редактирования товара
  │
  ▼
1. Из текущего image_url извлекается путь старого файла в Storage
2. Загружается новый файл (аналогично flow добавления, шаги 1-2)
3. Server Action:
   a. Обновляет shop_products.image_url на новый URL
   b. Удаляет старый файл: supabase.storage.from('product-images').remove([oldPath])
   Порядок важен: сначала сохраняем новый URL, потом удаляем старый файл —
   если удаление не сработает, мусор в Storage некритичен,
   а если сначала удалить старый — при ошибке обновления товар останется без картинки.
```

**Flow удаления картинки (без замены):**
```
Админ нажимает "Удалить картинку" в форме редактирования товара
  │
  ▼
1. Server Action:
   a. Обнуляет shop_products.image_url (SET image_url = NULL)
   b. Удаляет файл из Storage: supabase.storage.from('product-images').remove([path])
   UI переключается на отображение emoji или placeholder.
```

**Политики Storage:**
- SELECT (download): public — любой может видеть картинки
- INSERT (upload): только `is_admin = true`
- UPDATE/DELETE: только `is_admin = true`

**В UI карточки товара:** если `image_url` есть — показываем картинку. Если нет — показываем `emoji`. Fallback на дефолтный placeholder если ни того, ни другого.

**Ограничения:**
- Максимальный размер файла: 2 MB (настраивается в bucket)
- Допустимые форматы: `image/jpeg`, `image/png`, `image/webp`
- Валидация на клиенте (UX) + политика Storage (безопасность)

---

## Модули (src/modules/)

### Новые модули

#### `shop` — магазин (товары, категории, покупки)
```
src/modules/shop/
  types.ts          — ShopProduct, ShopCategory, ShopOrder, CreateProductInput, UpdateProductInput, CreateCategoryInput, UpdateCategoryInput, PurchaseInput, OrderStatus
  queries.ts        — getProducts, getProductById, getCategories, getUserOrders
  actions.ts        — purchaseProduct (без проверки isAdmin — доступна всем), createProduct, updateProduct, createCategory, updateCategory (все 4 проверяют isAdmin из JWT)
  components/       — ProductCard, ProductGrid, PurchaseButton, OrderHistory
  index.ts          — серверный API
  index.client.ts   — клиентский API
```

Весь CRUD товаров и категорий — в `shop`. Это один entity, одна зона ответственности. Админские страницы импортируют из `@/modules/shop` (page.tsx использует модуль — это не кросс-модульный импорт).

#### `admin` — админ-панель (пользователи, роли, заказы, события)
```
src/modules/admin/
  types.ts          — AdminUser, UpdateEventTypeInput, UpdateOrderStatusInput
  queries.ts        — getUsers, getUserDetail, getOrders, getEventTypes, getAdminStats
  actions.ts        — updateEventTypeCoins, updateOrderStatus, cancelOrder, toggleAdmin
  components/       — UsersTable, UserDetailModal, OrdersTable, EventTypesTable
  index.ts          — серверный API
  index.client.ts   — клиентский API
```

### Изменения в существующих модулях

#### `auth`
- `getCurrentUser` — добавить в `AuthUser`:
  - `isAdmin: boolean` — из JWT claim `is_admin`
  - `wsUserId: string | null` — из JWT claim `ws_user_id` (ws_users.id, нужен для покупок, заказов). 0 DB-запросов

---

## Роуты (src/app/)

### Изменения в существующих
- `/store` — переключить с мок-данных на реальные из `shop_products`

### Админка — отдельные роуты

**Решение: отдельные роуты вместо табов.**

Причины: каждый раздел грузит только свои данные, свой `loading.tsx`, можно делиться ссылкой, `revalidatePath` точечный, код разнесён по файлам.

```
src/app/(main)/admin/
  layout.tsx          — общий layout с навигацией между разделами
  page.tsx            — /admin — дашборд со статистикой (StatCards, сводка)
  users/
    page.tsx          — /admin/users — таблица сотрудников
    loading.tsx
  orders/
    page.tsx          — /admin/orders — таблица заказов
    loading.tsx
  products/
    page.tsx          — /admin/products — таблица товаров + категории
    loading.tsx
  events/
    page.tsx          — /admin/events — таблица событий с редактированием стоимости
    loading.tsx
```

**`layout.tsx`** — Server Component с навигационной панелью (ссылки на разделы), общий заголовок «Админ-панель». Проверка `isAdmin` — если не админ, редирект.

---

## Этапы реализации

### Этап 1: Роли и защита админки
- [x] Миграция: `ALTER TABLE ws_users ADD COLUMN is_admin boolean DEFAULT false`
- [x] Миграция: Custom Access Token Hook — pg-функция `custom_access_token_hook`, добавляет `is_admin` и `ws_user_id` в JWT claims
- [ ] Регистрация hook'а в Supabase Dashboard → Authentication → Hooks (ручной шаг)
- [x] ~~Миграция: удалить `second_life_cost`~~ — уже удалён из БД, очищены docs
- [x] Обновить `src/docs/gamification-db.md` и `src/docs/gamification-events.md` — убрать `second_life_cost`
- [x] Расширить `AuthUser` полями `isAdmin` (из JWT claim `is_admin`) и `wsUserId` (из JWT claim `ws_user_id`)
- [x] Middleware: защита `/admin/*` — проверка `is_admin` из JWT (0 DB-запросов), редирект для не-админов
- [ ] `checkIsAdmin()` — утилита для Server Actions (будет создана вместе с первыми админскими actions)
- [ ] Server Actions: проверка `is_admin` из JWT перед мутациями (будет в этапах 2-6)

### Этап 2: Управление событиями
- Миграция: RLS-политики на `gamification_event_types` (SELECT для всех, UPDATE для админов)
- `getEventTypes()` query
- `updateEventTypeCoins()` action
- UI: таблица событий с inline-редактированием стоимости

### Этап 3: Просмотр пользователей
- `getUsers()`, `getUserDetail()` queries
- UI: таблица сотрудников (баланс, отдел, статус)
- UI: детальный просмотр (баланс, транзакции, заказы)
- `toggleAdmin()` action — назначение/снятие админа

### Этап 4: Магазин — БД и бэкенд
- Миграции: `shop_categories`, `shop_products`, `shop_orders`
- Миграция: `is_dynamic_coins` в `gamification_event_types` + новые записи (`shop_purchase`, `shop_refund`)
- Миграция: SQL-функции `purchase_product` и `cancel_order` (`SECURITY INVOKER`, вызываются через `supabaseAdmin`)
- Seed начальных категорий (artifact, merch, upgrade, raffle)
- Supabase Storage: bucket `product-images` (public) + политики доступа
- RLS-политики на таблицах магазина
- `purchaseProduct()` action (Server Action → `supabaseAdmin.rpc('purchase_product')`)
- `getProducts()`, `getUserOrders()` queries

### Этап 5: Магазин — UI
- Переключить `/store` с мок-данных на реальные
- Карточки товаров (image_url → emoji → placeholder), фильтрация по категориям
- Кнопка покупки с проверкой баланса
- История покупок юзера

### Этап 6: Админка магазина
- CRUD категорий: `createCategory()`, `updateCategory()` actions
- UI: управление категориями
- CRUD товаров: `createProduct()`, `updateProduct()` actions + загрузка картинок
- UI: таблица товаров, форма создания/редактирования
- Управление заказами: `updateOrderStatus()`, `cancelOrder()` actions
- UI: таблица заказов с фильтрами и изменением статуса

---

## Открытые вопросы

1. ~~**Роли:** `is_admin` в `ws_users` — подходит?~~ ✅ Да, `is_admin` в `ws_users` + JWT Custom Access Token Hook. Единый источник — JWT claim. Проверка в middleware и Server Actions.
2. ~~**Физичность категории**~~ ✅ Да, `is_physical` на `shop_categories`. Определяет: статус заказа при покупке (`pending` vs `fulfilled`), доступность поля `stock`, безлимитность.
3. ~~**Остаток товара (stock)**~~ ✅ Да, `stock` есть. Физические — обязателен, уменьшается при покупке. Нефизические — `NULL` (безлимит), поле скрыто в UI.
4. ~~**Статусы заказов**~~ ✅ `pending → processing → fulfilled / cancelled` достаточно. CHECK constraint в БД + TypeScript union + Zod enum.
5. ~~**Возврат при отмене**~~ ✅ Да, `shop_refund` event_type. Сумма = `ABS(gamification_transactions.coins)` через JOIN на `transaction_id`. Кому = `shop_orders.user_id`. Транзакция возврата → `refund_transaction_id`.
6. ~~**Отмена fulfilled**~~ ✅ Да, можно отменить любой заказ кроме уже отменённого. В том числе `fulfilled` — на случай ошибки или возврата.
7. ~~**Лог изменений стоимости событий**~~ 📌 На будущее. Не реализуется в текущей итерации.
8. ~~**Картинки товаров**~~ ✅ Загрузка через Supabase Storage. Bucket `product-images` (public). Fallback: `image_url` → `emoji` → placeholder.
9. ~~**Структура админки**~~ ✅ Отдельные роуты (`/admin/users`, `/admin/orders`, `/admin/products`, `/admin/events`). Общий `layout.tsx` с навигацией.

---

## Известные ограничения и решения

### Race condition при покупке
Два одновременных запроса могут пройти проверку баланса и оба списать коины. `CHECK (stock >= 0)` защищает stock на уровне БД, но для баланса такого ограничения нет (отрицательный баланс допустим для штрафов).
**Решение:** обернуть `purchaseProduct` в SQL-функцию с `SELECT ... FOR UPDATE` на строку `gamification_balances` (блокирует конкурентные покупки одного юзера) и `FOR UPDATE OF p` на строку `shop_products` (блокирует конкурентные покупки одного товара разными юзерами).

### Деактивация категории
При `shop_categories.is_active = false` товары этой категории должны быть скрыты из магазина.
**Решение:** все запросы к магазину фильтруют `WHERE p.is_active = true AND c.is_active = true`. Существующие заказы (`pending`, `processing`) остаются доступными для обработки в админке. При деактивации UI показывает кол-во незавершённых заказов.

### `status_changed_by` — только последняя смена
Если заказ прошёл `pending → processing → fulfilled`, записан только последний админ. История переходов не хранится. Для MVP достаточно.

---

## Критерии готовности

- [ ] Роли работают: первый админ через БД, далее через UI
- [ ] Админка защищена: не-админы не видят страницу и не могут вызвать actions
- [ ] Магазин показывает товары из БД, покупка списывает коины
- [ ] При покупке создаётся запись в gamification_transactions
- [ ] Проверка баланса перед покупкой
- [ ] Админ видит заказы, может менять статус
- [ ] Админ видит список юзеров с балансами и транзакциями
- [ ] Админ может менять стоимость событий
- [ ] Админ может добавлять/редактировать товары
- [ ] Админ может назначать других админов
