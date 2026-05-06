# shop

Магазин геймификации: товары, категории, покупки, заказы.

## Логика работы

Сотрудники тратят 💎 на товары. Цена в кристаллах — производная от себестоимости в BYN, коэффициента наценки и текущего курса: `price_crystals = round(cost_byn × coefficient × current_crystal_rate())`. Курс хранится с историей в таблице `crystal_rates`, последняя запись = актуальный курс. Колонки `shop_products.price` нет — цена считается на лету в `purchase_product` и в `getProducts*`.

Покупка — атомарная SQL-функция `purchase_product`: блокирует строку товара, читает `cost_byn` + `coefficient`, вычисляет `v_price` через `current_crystal_rate()`, проверяет баланс, списывает, создаёт event_log + транзакцию + заказ, обновляет stock. Нефизические товары (`is_physical = false`) — сразу `fulfilled`. Физические — `pending`, ждут обработки админом. Учёт остатков определяется флагом `is_countable` на категории: `is_countable = true` → `stock` обязателен и уменьшается при покупке; `is_countable = false` → `stock = NULL` (безлимит).

Отмена заказа — SQL-функция `cancel_order` (возврат 💎 по `coins` из исходной транзакции, запись refund-транзакции, возврат stock). Доступна только админам.

Обе функции `SECURITY INVOKER`, вызываются через `supabaseAdmin` (service_role).

`gamification_transactions.byn_amount` заполняется автоматически триггером `BEFORE INSERT trg_set_byn_amount` (`NEW.coins / current_crystal_rate()`), если вызывающий код не задал поле явно.

Загрузка изображений товаров — через API route `/api/admin/upload-product-image` (не Server Action, чтобы обойти лимит 1 МБ на body в Next.js 16).

## Зависимости

- Таблицы: `shop_categories`, `shop_products` (`cost_byn`, `coefficient`, без `price`), `shop_orders`, `crystal_rates`
- Связь с: `gamification_event_logs`, `gamification_transactions` (`byn_amount`), `gamification_balances`, `ws_users`
- Event types: `shop_purchase` (is_dynamic_coins), `shop_refund` (is_dynamic_coins)
- SQL-функция: `current_crystal_rate()` — последний курс из `crystal_rates`
- Триггер: `trg_set_byn_amount` BEFORE INSERT на `gamification_transactions` — заполняет `byn_amount`
- Storage: bucket `product-images` (public)
- API route: `/api/admin/upload-product-image` — загрузка изображений (POST, FormData)
- Модули: `auth` (getCurrentUser, wsUserId), `admin` (checkIsAdmin)

## Типы

- `OrderStatus` — `'pending' | 'processing' | 'fulfilled' | 'cancelled'`. Константа `ORDER_STATUSES` и Zod-схема `orderStatusSchema`
- `ShopCategory` — категория: id, name, slug, description, is_physical, is_countable, is_active, sort_order
- `ShopProduct` — товар: id, name, description, cost_byn, coefficient, price (вычислено), category_id, image_url, emoji, stock, is_active, sort_order, created_by, updated_at
- `ShopProductWithCategory` — товар + вложенная категория (name, slug, is_physical, is_countable, is_active)
- `ShopOrderWithDetails` — заказ + название товара + emoji + image_url + coins_spent (через JOIN на transaction)
- `PurchaseResult` — результат покупки из RPC: order_id, new_balance, coins_spent
- `CancelResult` — результат отмены из RPC: order_id, refunded_coins, new_balance
- `CrystalRate` — запись истории курсов: id, rate, created_at, created_by
- `SetCrystalRateInput` — Zod: `rate > 0`
- Zod-схемы: `createCategorySchema`, `updateCategorySchema`, `createProductSchema` (cost_byn + coefficient вместо price), `updateProductSchema`, `setCrystalRateSchema`

## Actions

- `getBalanceAction()` — возвращает баланс текущего пользователя. Используется для polling на клиенте (CoinBalanceLive). Не требует параметров — берёт wsUserId из сессии
- `purchaseProduct(productId)` — покупка, доступна всем. RPC `purchase_product`. Revalidate: `/store`, `/profile`
- `createCategory(input)` — создание категории. Только админ. Revalidate: `/admin/products`, `/store`
- `updateCategory(input)` — обновление категории (name, slug, description, is_physical, is_countable, is_active). При `is_countable = false` сбрасывает `stock` в NULL у всех товаров категории. Только админ
- `createProduct(input)` — создание товара (cost_byn, coefficient). Только админ. Записывает `created_by`
- `updateProduct(input)` — обновление товара (включая cost_byn, coefficient, is_active). Только админ
- `deleteProduct(productId)` — удаление товара. Проверяет наличие заказов — если есть, блокирует. Удаляет изображение из Storage. Только админ
- `setCrystalRate({ rate })` — INSERT новой записи в `crystal_rates`, последняя становится актуальной. Только админ. `updateTag('crystal-rate')` + `updateTag('shop-products')` (цены товаров пересчитаются), revalidate: `/admin/products`, `/admin/economy`, `/store`
- `uploadProductImage(formData)` — загрузка изображения в Storage bucket `product-images`. Валидация: JPEG/PNG/WebP, max 2 МБ. Path: `products/{timestamp}_{uuid}.{ext}`. Только админ
- `deleteProductImage(imageUrl)` — удаление изображения из Storage по публичному URL. Только админ

## Queries

- `getCategories()` — активные категории, отсортированные по sort_order. Серверный клиент. Кэш-тег `shop-categories`
- `getAllCategories()` — все категории (для админки). supabaseAdmin
- `getProducts(categorySlug?)` — активные товары с активными категориями. Фильтр по slug. Считает `price = round(cost_byn × coefficient × current_rate)` и подставляет в каждый объект. Кэш-тег `shop-products`
- `getAllProducts()` — все товары с категориями (для админки, включая неактивные). supabaseAdmin. Также подставляет вычисленный `price`
- `getProductById(id)` — один товар с категорией + вычисленным price
- `getCurrentRate()` — текущий курс из последней записи `crystal_rates`. Кэш-тег `crystal-rate`. Используется в каждом `getProducts*`
- `getUserOrders(wsUserId)` — заказы пользователя с названием товара, emoji, image_url и суммой. supabaseAdmin
- `getUserBalance(wsUserId)` — баланс пользователя из gamification_balances. supabaseAdmin

## Hooks

- `useBalance()` — polling баланса через `createSimpleCacheQuery`. Query key: `queryKeys.balance.current()`. staleTime: `realtime` (1 мин). Интервал polling: 30 сек (передаётся через `refetchInterval` в компоненте). Polling автоматически останавливается при неактивной вкладке (встроено в TanStack Query)

## Компоненты

- `CoinBalanceLive` (`src/components/CoinBalance.tsx`) — клиентский компонент баланса с polling. Принимает `initialAmount` (SSR-значение) — показывает его до первого ответа polling. Используется в Sidebar
- `StoreClient` — клиентский контейнер: фильтрация по категориям, optimistic update баланса при покупке, toast-уведомления (3 сек). Grid: 2 колонки → 3 на lg → 4 на xl
- `ProductCard` — карточка товара: image_url (object-contain) / emoji / placeholder (?), фон emoji — var(--apex-emoji-bg), разделитель между картинкой и футером, футер с var(--apex-bg). Бейдж «мало» при stock ≤ 5 (физические), бейдж «нет в наличии». Staggered-анимация по index. Описание: `line-clamp-2` по умолчанию; если текст реально обрезан (detect через ResizeObserver на scrollHeight/clientHeight) — клик по описанию раскрывает его полностью (toggle). Соседние карточки в строке растягиваются за счёт CSS Grid `align-items: stretch`
- `PurchaseButton` — кнопка покупки: проверка баланса и stock, динамический текст (покупаем/нет в наличии/ещё N 💎/получить за N 💎)
- `OrdersClient` — клиентский контейнер страницы «Мои заказы»: фильтрация по статусу, отображение image_url / emoji / placeholder, ссылка на магазин при пустом списке

## Страницы

- `/store` — `getProducts()` + `getCategories()` + `getUserBalance()` параллельно → `StoreClient`. Редирект на `/login` без авторизации
- `/store/orders` — `getUserOrders()` → `OrdersClient`. Редирект на `/login` без авторизации, на `/store` без wsUserId

Обе страницы имеют `loading.tsx` со скелетонами.

## Утилиты

- `computePriceCrystals(costByn, coefficient, rate)` — `Math.round(costByn × coefficient × rate)`. Цена для пользователя — всегда целое число
- `coinsToByn(coins, rate)` — `Math.round(coins / rate * 100) / 100`. Используется в дашборде экономики
- `formatByn(amount)` — `"1 250,50 BYN"` (ru-BY locale, 2 знака после запятой)

## Ограничения

- `stock` обязателен для исчисляемых категорий (`is_countable = true`), валидация в Server Action, не в БД
- `stock = NULL` для неисчисляемых (`is_countable = false`) — безлимит, поле скрыто в UI, не редактируемо inline
- `is_physical` определяет статус заказа (pending/fulfilled), `is_countable` определяет учёт остатков — это независимые флаги
- Отмена доступна для любого статуса кроме `cancelled`. Idempotency через `shop_refund_{order_id}`
- Race condition при покупке: защита через `FOR UPDATE` на balance и product
- `cancelOrder` — в модуле `admin`, не здесь (админская операция)
- Slug категории: только строчные латинские буквы, цифры и \_, начинается с буквы, уникальный
- Цена товара в кристаллах не хранится в БД — всегда вычисляется. При смене курса все цены пересчитываются автоматически. Refund использует фактически списанные кристаллы из транзакции, не пересчитывает по новому курсу
