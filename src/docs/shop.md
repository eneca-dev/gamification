# shop

Магазин геймификации: товары, категории, покупки, заказы.

## Логика работы

Сотрудники тратят 💎 на товары. Цена в кристаллах: `max(1, round(cost_byn × coefficient × current_crystal_rate()) + price_adjustment_crystals)`. Целочисленная поправка `price_adjustment_crystals` используется для точного массового изменения на ± кристаллов и сохраняется при смене курса. Курс хранится с историей в таблице `crystal_rates`, последняя запись = актуальный курс. Колонки `shop_products.price` нет — цена считается на лету в обоих вариантах `purchase_product` и в `getProducts*`.

Покупка — атомарная SQL-функция `purchase_product`: блокирует строку товара, читает `cost_byn` + `coefficient`, вычисляет `v_price` через `current_crystal_rate()`, проверяет баланс, списывает, создаёт event_log + транзакцию + заказ, обновляет stock. Нефизические товары (`is_physical = false`) — сразу `fulfilled`. Физические — `pending`, ждут обработки админом. Если товар имеет флаг `comment_required = true`, RPC требует непустой `p_user_comment` — иначе RAISE EXCEPTION `'comment_required'`. Комментарий сохраняется в `shop_orders.user_comment`. Учёт остатков определяется флагом `is_countable` на категории: `is_countable = true` → `stock` обязателен и уменьшается при покупке; `is_countable = false` → `stock = NULL` (безлимит).

После успешной обычной покупки сервер отправляет карточку в отдельный Teams Workflow через `TEAMS_ORDERS_WEBHOOK_URL`. Уведомление включает товар, покупателя, списанные кристаллы и комментарий. Товары с `effect` (включая «Вторую жизнь») и категория `draw` не уведомляют. Ошибка Teams не отменяет покупку и записывается в серверный лог. URL webhook хранится только в серверном окружении; получатель настраивается в отдельном потоке Teams.

Отмена заказа — SQL-функция `cancel_order` (возврат 💎 по `coins` из исходной транзакции, запись refund-транзакции, возврат stock). Доступна только админам.

Обе функции `SECURITY INVOKER`, вызываются через `supabaseAdmin` (service_role).

`gamification_transactions.byn_amount` заполняется автоматически триггером `BEFORE INSERT trg_set_byn_amount` (`NEW.coins / current_crystal_rate()`), если вызывающий код не задал поле явно.

Загрузка изображений товаров — через API route `/api/admin/upload-product-image` (не Server Action, чтобы обойти лимит 1 МБ на body в Next.js 16).

Карточка товара поддерживает до 3 фото и 1 видео (загруженное или YouTube): изображения в bucket `product-images`, загруженные видео в bucket `product-videos`. Хранится в колонке `shop_products.media` (jsonb-массив):
- `{kind:'image', url}` — ссылка на `product-images/products/*`
- `{kind:'youtube', video_id}` — 11-символьный ID
- `{kind:'video', url, poster_url}` — видео в `product-videos/videos/*` + постер в `product-images/posters/*` (nullable, если браузер не смог снять кадр)

`image_url` остаётся как «обложка» — синхронизируется из первой картинки `media` в `createProduct`/`updateProduct` и используется в `OrdersClient`, `AdminOrdersClient`, `CategoryBreakdownChart` без изменений. Видео (YouTube и загруженные) проигрываются с lazy-facade: постер + кнопка Play, iframe/`<video>` монтируется только после клика.

**Загрузка видео** идёт мимо API route через `createSignedUploadUrl`: сервер (`/api/admin/product-video/signed-url`) создаёт одноразовую подписанную ссылку, клиент льёт файл PUT-запросом напрямую в Storage с прогрессом через XHR. Это обходит лимит serverless body (4.5 МБ) при лимите видео 20 МБ. Постер снимается на клиенте из первой секунды видео (`<video>` + `canvas` → JPEG) и грузится через существующий API `/api/admin/upload-product-image?kind=poster`.

При обновлении товара картинки, постеры и видео, исчезнувшие из `media`, удаляются из соответствующих bucket'ов. При удалении товара удаляются все его медиа-файлы.

**Лимиты на товар**: максимум `MAX_PRODUCT_PHOTOS` (3) фото и `MAX_PRODUCT_VIDEOS` (1) видео. Видео считается суммарно: YouTube и загруженный файл вместе = 1. Zod `productMediaSchema.superRefine` валидирует на сервере, UI формы блокирует добавление по типу при достижении лимита.

**Квота Supabase Storage**: `src/lib/storage-quota.ts` → `assertCanUpload(bytes)` блокирует загрузку, если текущее занятое место + новый файл превысят **70% от плана** (`STORAGE_PLAN_BYTES = 100 ГБ` для Pro). SQL-функция `public.get_storage_used_bytes()` возвращает SUM по всем bucket'ам Storage. Кэш 5 минут. Применяется в обоих upload routes перед записью в Storage. При смене плана Supabase — изменить константу `STORAGE_PLAN_BYTES`.

## Зависимости

- Таблицы: `shop_categories`, `shop_products` (`cost_byn`, `coefficient`, `price_adjustment_crystals`, `media jsonb`, `image_url` (обложка), `comment_required`, `comment_label`, `comment_placeholder`), `shop_orders` (`user_comment`), `crystal_rates`
- Связь с: `gamification_event_logs`, `gamification_transactions` (`byn_amount`), `gamification_balances`, `ws_users`
- Event types: `shop_purchase` (is_dynamic_coins), `shop_refund` (is_dynamic_coins)
- SQL-функция: `current_crystal_rate()` — последний курс из `crystal_rates`
- Триггер: `trg_set_byn_amount` BEFORE INSERT на `gamification_transactions` — заполняет `byn_amount`
- Storage: bucket `product-images` (public, 2 МБ, image/*), bucket `product-videos` (public, 20 МБ, video/mp4|webm)
- API route: `/api/admin/upload-product-image` — загрузка изображений (POST, FormData); `?kind=poster` сохраняет файл в папку `posters/`. Перед записью вызывает `assertCanUpload(file.size)`
- API route: `/api/admin/product-video/signed-url` — одноразовая signedUploadUrl для direct-upload видео (POST). Принимает `{ ext, size }`, проверяет `size <= 20 МБ` и `assertCanUpload(size)` до выдачи URL
- Хелпер: `src/lib/storage-quota.ts` — `STORAGE_PLAN_BYTES`, `STORAGE_SOFT_LIMIT`, `getStorageUsedBytes()`, `assertCanUpload(bytes)`
- SQL-функция: `public.get_storage_used_bytes()` — SUM metadata.size по всей `storage.objects`
- Модули: `auth` (getCurrentUser, wsUserId), `admin` (checkIsAdmin)

## Типы

- `OrderStatus` — `'pending' | 'processing' | 'fulfilled' | 'cancelled'`. Константа `ORDER_STATUSES` и Zod-схема `orderStatusSchema`
- `ShopCategory` — категория: id, name, slug, description, is_physical, is_countable, is_active, sort_order
- `ShopProduct` — товар: id, name, description, cost_byn, coefficient, price_adjustment_crystals, price (вычислено), category_id, image_url (обложка, синхр. с media), media (ProductMediaItem[]), emoji, effect, stock, discount_percent (integer | null), is_active, is_coming_soon, comment_required (boolean), comment_label (text | null), comment_placeholder (text | null), sort_order, created_by, updated_at
- `ProductMediaItem` — элемент медиа: `{kind:'image', url}` (Storage), `{kind:'youtube', video_id}` (11-символьный ID) или `{kind:'video', url, poster_url}` (Storage + nullable постер)
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
- `bulkUpdateProducts({ ids, change })` — массовое изменение выбранных товаров: точное изменение цены на ± кристаллов через `price_adjustment_crystals`, визуальная скидка или статус. Только админ; результат содержит успешные ID и ошибки по товарам
- `deleteProduct(productId)` — удаление товара. Проверяет наличие заказов — если есть, блокирует. Удаляет изображение из Storage. Только админ
- `setCrystalRate({ rate })` — INSERT новой записи в `crystal_rates`, последняя становится актуальной. Только админ. `updateTag('crystal-rate')` + `updateTag('shop-products')` (цены товаров пересчитаются), revalidate: `/admin/products`, `/admin/economy`, `/store`
- `uploadProductImage(formData)` — загрузка изображения в Storage bucket `product-images`. Валидация: JPEG/PNG/WebP, max 2 МБ. Path: `products/{timestamp}_{uuid}.{ext}`. Только админ
- `deleteProductImage(imageUrl)` — удаление изображения из Storage по публичному URL. Только админ

## Queries

- `getCategories()` — активные категории, отсортированные по sort_order. Серверный клиент. Кэш-тег `shop-categories`
- `getAllCategories()` — все категории (для админки). supabaseAdmin
- `getProducts(categorySlug?)` — активные товары с активными категориями. Фильтр по slug. Считает цену с учётом целочисленной поправки и подставляет в каждый объект. Кэш-тег `shop-products`
- `getAllProducts()` — все товары с категориями (для админки, включая неактивные). supabaseAdmin. Также подставляет вычисленный `price`
- `getProductById(id)` — один товар с категорией + вычисленным price
- `getCurrentRate()` — текущий курс из последней записи `crystal_rates`. Кэш-тег `crystal-rate`. Используется в каждом `getProducts*`
- `getUserOrders(wsUserId)` — заказы пользователя с названием товара, emoji, image_url и суммой. supabaseAdmin
- `getUserBalance(wsUserId)` — баланс пользователя из gamification_balances. supabaseAdmin

## Hooks

- `useBalance(userId)` — polling баланса через `createCacheQuery`. Query key: `queryKeys.balance.current(userId)`. staleTime: `realtime` (1 мин). Интервал polling: 5 минут (передаётся через `refetchInterval` в компоненте). Polling автоматически останавливается при неактивной вкладке (встроено в TanStack Query)

## Компоненты

- `CoinBalanceLive` (`src/components/CoinBalance.tsx`) — клиентский компонент баланса с polling. Принимает `initialAmount` (SSR-значение) и `userId` для ключа кэша. Используется в Sidebar
- `StoreClient` — клиентский контейнер: фильтрация по категориям, optimistic update баланса при покупке, toast-уведомления (3 сек). Grid: 2 колонки → 3 на lg → 4 на xl
- `ProductCard` — карточка товара: обложка (image_url или mediaPoster активного элемента) object-contain / emoji / placeholder (?), фон emoji — var(--apex-emoji-bg). При `media.length > 1` снизу поверх картинки — ряд точек-пилюль: `onMouseEnter` переключает активный элемент (preview меняется), `onClick` открывает `ProductMediaGallery` с `initialIndex=i`. `onMouseLeave` зоны картинки возвращает активный на 0. Для video/youtube активного — иконка `Play` поверх постера. Бейджи на картинке (top-left): «Скоро в продаже», «Нет в наличии», «Осталось: N»; бейдж «−X%» (top-right, красный) при `discount_percent != null`. Над кнопкой покупки при скидке — блок с зачёркнутой ценой и «скидка −X%» на светло-красном фоне. Staggered-анимация по index. Описание: `line-clamp-2` по умолчанию; если текст реально обрезан (ResizeObserver на scrollHeight/clientHeight) — клик раскрывает полностью (toggle)
- `ProductMediaGallery` — модалка-портал с галереей медиа товара. Клавиши ←/→/Esc переключают слайды и закрывают окно; фокус остаётся внутри модалки и возвращается к открывшей кнопке. `initialIndex` открывает нужный слайд. Видео (YouTube iframe и `<video>` для файлов из `product-videos`) монтируется только после клика по постеру. При переключении слайда видео размонтируется. Backdrop чёрный полупрозрачный, подложка картинки белая
- `MediaStackPreview` — переиспользуемая превью медиа товара для админки. Props: `media`, `imageUrl` (обложка), `emoji`, `name`, `size` ('sm' = таблица 40×40 или 'lg' = grid h-36). `lg` → fan-stack: 2-е и 3-е медиа выглядывают из-за обложки с rotate/translate/opacity (эффект стопки фото). `sm` → обложка + бейдж `+N` в правом нижнем углу вне рамки + иконка `Play` в правом верхнем если есть видео
- `PurchaseButton` — кнопка покупки: проверка баланса и stock, динамический текст. Перед каждой покупкой открывает подтверждение через портал без прокрутки страницы, с названием и итоговой ценой. Если `commentRequired=true`, в том же окне обязателен комментарий. Отмена не вызывает покупку
- `OrdersClient` — клиентский контейнер страницы «Мои заказы»: фильтрация по статусу, отображение image_url / emoji / placeholder, ссылка на магазин при пустом списке

**Админ-компоненты** (в `src/modules/admin/`):
- `ProductsClient` — инлайн-редактирование `discount_percent`: Enter = сохранить, Esc = отменить, пустое значение = `null` (убрать скидку). Выделение товаров в таблице и карточках, массовое изменение цены на ± кристаллов, визуальной скидки и статуса. Фильтры: `скидка:есть` / `скидка:нет`. `handleProductSave` принимает `MediaDraftItem[]`: загружает `new`-картинки через API route, собирает финальный `ProductMediaItem[]` и передаёт в create/update
- `ProductFormModal` — поле «Наценка %» с кнопкой очистки (×). Live-preview: зачёркнутая цена в кристаллах и процент скидки для покупателя. Блок «Требовать комментарий при покупке» — чекбокс + поля comment_label и comment_placeholder (отображаются только при включённом флаге). Блок «Медиа» со счётчиками `фото N/3 · видео N/1`: список с мини-превью, кнопками ↑/↓/×, флагом «Главное фото» на первой картинке. Один dropzone/file-input принимает фото (JPEG/PNG/WebP до 2 МБ) и видео (MP4/WebM до 20 МБ, постер снимается автоматически через `captureVideoPoster`). При достижении лимита по типу — accept input сужается, при обоих лимитах dropzone серый. Для видео в списке — полоса прогресса. YouTube — отдельное поле ввода с парсингом через `parseYouTubeId`, блокируется при `countVideos >= MAX_PRODUCT_VIDEOS`. onSave принимает третий аргумент `setProgress(index, pct)` — колбек, которым `ProductsClient` обновляет прогресс конкретного видео в state модалки

## Страницы

- `/store` — `getProducts()` + `getCategories()` + `getUserBalance()` параллельно → `StoreClient`. Редирект на `/login` без авторизации
- `/store/orders` — `getUserOrders()` → `OrdersClient`. Редирект на `/login` без авторизации, на `/store` без wsUserId

Обе страницы имеют `loading.tsx` со скелетонами.

## Утилиты

- `parseYouTubeId(input)` — извлекает 11-символьный videoId из форматов `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/embed/`, `shorts/`, `live/`, или сырого ID. Возвращает `null` для невалидного ввода
- `youTubePoster(videoId)` — URL превью `https://img.youtube.com/vi/{id}/hqdefault.jpg`
- `youTubeEmbedSrc(videoId)` — URL iframe `https://www.youtube.com/embed/{id}?rel=0&modestbranding=1&autoplay=1`
- `mediaPoster(item)` — URL превью для элемента медиа (image.url, youtube-постер или video.poster_url, может быть null)
- `coverImageUrl(media)` — URL первой картинки или `null`. Используется в Server Actions для синхронизации `image_url`
- `hasVideo(media)` — есть ли среди медиа видео (YouTube или загруженное) — для иконки на карточке
- `captureVideoPoster(file)` — снимает JPEG-постер (кадр ~1 сек) из видео через `<video>` + canvas. Возвращает `Blob | null` (null при провале браузера)
- `uploadWithProgress({ url, file, contentType, onProgress, signal })` — PUT-загрузка через XHR с progress-событиями и AbortSignal. Используется для direct-upload видео в Storage по signedUploadUrl
- При ошибке сохранения товара клиент откатывает optimistic update и вызывает `cleanupFailedProductUploads` для новых файлов. При замене или удалении товара Server Action удаляет файлы только после проверки, что на них больше не ссылаются товары и лотереи. Обновление медиа проверяет `expected_updated_at`, поэтому устаревшая форма получает сообщение о конфликте
- `computePriceCrystals(costByn, coefficient, rate, adjustment?)` — `Math.max(1, Math.round(costByn × coefficient × rate) + adjustment)`. Цена для пользователя — всегда положительное целое число
- `computePriceWithoutDiscount(priceInCrystals, discountPercent)` — `Math.round(priceInCrystals / (1 - discountPercent / 100))`. Зачёркнутая цена в кристаллах
- `computeDisplayDiscount(discountPercent)` — возвращает сохранённый процент скидки для бейджа
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
