# shop

Магазин геймификации: товары, категории, покупки, заказы.

## Логика работы

Сотрудники тратят 💎 на товары. Цена в кристаллах — производная от себестоимости в BYN, коэффициента наценки и текущего курса: `price_crystals = round(cost_byn × coefficient × current_crystal_rate())`. Курс хранится с историей в таблице `crystal_rates`, последняя запись = актуальный курс. Колонки `shop_products.price` нет — цена считается на лету в `purchase_product` и в `getProducts*`.

Покупка — атомарная SQL-функция `purchase_product`: блокирует строку товара, читает `cost_byn` + `coefficient`, вычисляет `v_price` через `current_crystal_rate()`, проверяет баланс, списывает, создаёт event_log + транзакцию + заказ, обновляет stock. Нефизические товары (`is_physical = false`) — сразу `fulfilled`. Физические — `pending`, ждут обработки админом. Если товар имеет флаг `comment_required = true`, RPC требует непустой `p_user_comment` — иначе RAISE EXCEPTION `'comment_required'`. Комментарий сохраняется в `shop_orders.user_comment`. Учёт остатков определяется флагом `is_countable` на категории: `is_countable = true` → `stock` обязателен и уменьшается при покупке; `is_countable = false` → `stock = NULL` (безлимит).

Отмена заказа — SQL-функция `cancel_order` (возврат 💎 по `coins` из исходной транзакции, запись refund-транзакции, возврат stock). Доступна только админам.

Обе функции `SECURITY INVOKER`, вызываются через `supabaseAdmin` (service_role).

`gamification_transactions.byn_amount` заполняется автоматически триггером `BEFORE INSERT trg_set_byn_amount` (`NEW.coins / current_crystal_rate()`), если вызывающий код не задал поле явно.

Загрузка изображений товаров — через API route `/api/admin/upload-product-image` (не Server Action, чтобы обойти лимит 1 МБ на body в Next.js 16).

## Зависимости

- Таблицы: `shop_categories`, `shop_products` (`cost_byn`, `coefficient`, `comment_required`, `comment_label`, `comment_placeholder`), `shop_orders` (`user_comment`), `crystal_rates`
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
- `ShopProduct` — товар: id, name, description, cost_byn, coefficient, price (вычислено), category_id, image_url, emoji, effect, stock, discount_percent (integer | null), is_active, is_coming_soon, comment_required (boolean), comment_label (text | null), comment_placeholder (text | null), sort_order, created_by, updated_at
- `ShopProductWithCategory` — товар + вложенная категория (name, slug, is_physical, is_countable, is_active)
- `ShopOrder` — заказ: id, user_id, product_id, status, transaction_id, refund_transaction_id, note, user_comment (text | null), created_at
- `ShopOrderWithDetails` — заказ + название товара + emoji + image_url + coins_spent (через JOIN на transaction)
- `PurchaseResult` — результат покупки из RPC: order_id, new_balance, coins_spent
- `CancelResult` — результат отмены из RPC: order_id, refunded_coins, new_balance
- `CrystalRate` — запись истории курсов: id, rate, created_at, created_by
- `SetCrystalRateInput` — Zod: `rate > 0`
- Zod-схемы: `createCategorySchema`, `updateCategorySchema`, `createProductSchema` (cost_byn + coefficient вместо price), `updateProductSchema`, `setCrystalRateSchema`

## Actions

- `getBalanceAction()` — возвращает баланс текущего пользователя. Используется для polling на клиенте (CoinBalanceLive). Не требует параметров — берёт wsUserId из сессии
- `purchaseProduct({ product_id, user_comment? })` — покупка, доступна всем. RPC `purchase_product`. Если товар требует комментарий и он пустой — RPC возвращает ошибку `'comment_required'`, Action возвращает `{ success: false, error: 'Необходимо указать комментарий' }`. Revalidate: `/store`, `/profile`
- `createCategory(input)` — создание категории. Только админ. Revalidate: `/admin/products`, `/store`
- `updateCategory(input)` — обновление категории (name, slug, description, is_physical, is_countable, is_active). При `is_countable = false` сбрасывает `stock` в NULL у всех товаров категории. Только админ
- `createProduct(input)` — создание товара (cost_byn, coefficient). Только админ. Записывает `created_by`
- `updateProduct(input)` — обновление товара (включая cost_byn, coefficient, discount_percent, is_active). `discount_percent: null` убирает скидку. Только админ. Revalidate: `shop-products`
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
- `ProductCard` — карточка товара: image_url (object-contain) / emoji / placeholder (?), фон emoji — var(--apex-emoji-bg). Бейджи на картинке (top-left): «Скоро в продаже», «Нет в наличии», «Осталось: N»; бейдж «−X%» (top-right, красный) при `discount_percent != null`. Над кнопкой покупки при скидке — блок с зачёркнутой ценой и «скидка −X%» на светло-красном фоне. Staggered-анимация по index. Описание: `line-clamp-2` по умолчанию; если текст реально обрезан (ResizeObserver на scrollHeight/clientHeight) — клик раскрывает полностью (toggle)
- `PurchaseButton` — кнопка покупки: проверка баланса и stock, динамический текст. Если `commentRequired=true` — при клике открывает inline-диалог с textarea; кнопка подтверждения заблокирована пока поле пустое (UX-блокировка). Комментарий передаётся в `onPurchase(productId, price, userComment)`
- `OrdersClient` — клиентский контейнер страницы «Мои заказы»: фильтрация по статусу, отображение image_url / emoji / placeholder, ссылка на магазин при пустом списке

**Админ-компоненты** (в `src/modules/admin/`):
- `ProductsClient` — инлайн-редактирование `discount_percent`: Enter = сохранить, Esc = отменить, пустое значение = `null` (убрать скидку). Фильтры: `скидка:есть` / `скидка:нет`
- `ProductFormModal` — поле «Наценка %» с кнопкой очистки (×). Live-preview: зачёркнутая цена в кристаллах и процент скидки для покупателя. Блок «Требовать комментарий при покупке» — чекбокс + поля comment_label и comment_placeholder (отображаются только при включённом флаге)

## Страницы

- `/store` — `getProducts()` + `getCategories()` + `getUserBalance()` параллельно → `StoreClient`. Редирект на `/login` без авторизации
- `/store/orders` — `getUserOrders()` → `OrdersClient`. Редирект на `/login` без авторизации, на `/store` без wsUserId

Обе страницы имеют `loading.tsx` со скелетонами.

## Утилиты

- `computePriceCrystals(costByn, coefficient, rate)` — `Math.round(costByn × coefficient × rate)`. Цена для пользователя — всегда целое число
- `computePriceWithoutDiscount(priceInCrystals, discountPercent)` — `Math.round(priceInCrystals × (1 + discountPercent / 100))`. Зачёркнутая цена в кристаллах
- `computeDisplayDiscount(discountPercent)` — `Math.round(discountPercent / (100 + discountPercent) × 100)`. Процент скидки для бейджа (без дрейфа от округления кристаллов)
- `coinsToByn(coins, rate)` — `Math.round(coins / rate * 100) / 100`. Используется в дашборде экономики
- `formatByn(amount)` — `"1 250,50 BYN"` (ru-BY locale, 2 знака после запятой)

## Ограничения

- `stock` обязателен для исчисляемых категорий (`is_countable = true`), валидация в Server Action, не в БД
- `stock = NULL` для неисчисляемых (`is_countable = false`) — безлимит, поле скрыто в UI, не редактируемо inline
- Инвариант `stock=0 ⇒ is_active=false` для исчисляемых: `createProduct` и `updateProduct` принудительно ставят `is_active=false` при `stock=0`. Активация (`is_active=true`) с нулевым остатком блокируется ошибкой. В админке тоггл активности заблокирован, пока остаток = 0 — для активации нужно сначала ввести количество > 0
- `is_physical` определяет статус заказа (pending/fulfilled), `is_countable` определяет учёт остатков — это независимые флаги
- Отмена доступна для любого статуса кроме `cancelled`. Idempotency через `shop_refund_{order_id}`
- Race condition при покупке: защита через `FOR UPDATE` на balance и product
- `cancelOrder` — в модуле `admin`, не здесь (админская операция)
- Slug категории: только строчные латинские буквы, цифры и \_, начинается с буквы, уникальный
- Цена товара в кристаллах не хранится в БД — всегда вычисляется. При смене курса все цены пересчитываются автоматически. Refund использует фактически списанные кристаллы из транзакции, не пересчитывает по новому курсу
