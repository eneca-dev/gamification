# admin

Админ-панель для управления системой геймификации: события, пользователи, товары, заказы.

## Логика работы

Все actions проверяют `is_admin` через `checkIsAdmin()` — декодирование JWT access_token. Админские actions используют `supabaseAdmin` (service role, обходит RLS) — защита на уровне кода через `checkIsAdmin()`. Пользовательские actions (покупка и т.д.) используют обычный клиент + RLS.

Админ может менять стоимость событий (coins) в `gamification_event_types`. Добавление/удаление event types запрещено — они создаются в миграциях и привязаны к триггерам/скриптам.

Управление заказами: смена статуса (pending/processing/fulfilled) через дропдаун на статус-бейдже, отмена с возвратом коинов через модал подтверждения. Нефизические товары — статус не меняется (только отмена).

Управление товарами: inline-редактирование категории, цены и остатка в таблице. Полное редактирование через модалку (ProductFormModal). Удаление товара с проверкой наличия заказов. Загрузка изображений через drag-and-drop (API route, не Server Action).

Управление категориями: inline-редактирование всех полей (name, slug, description, is_physical). Slug валидируется: только строчные латинские, цифры, _, начинается с буквы, уникальный. Деактивация категории блокирует тоггл статуса у товаров этой категории.

## Зависимости

- `gamification_event_types` — справочник событий (SELECT для authenticated, UPDATE для админов)
- `ws_users` — справочник сотрудников (is_admin)
- `shop_orders` — заказы (JOIN с ws_users, shop_products, shop_categories, gamification_transactions)
- `custom_access_token_hook` — pg-функция, добавляет `is_admin` и `ws_user_id` в JWT
- Модули: `auth` (getCurrentUser), `shop` (actions, queries, types)

## Типы

- `EventTypeRow` — строка из `gamification_event_types`: key, name, coins, description, is_active
- `UpdateEventTypeInput` — Zod-схема: key (string, обязателен), name/coins/description/is_active (опционально)
- `AdminUserRow` — пользователь с балансом: id, email, first_name, last_name, department, team, is_admin, is_active, total_coins
- `UserDetail` — `{ user: AdminUserRow, transactions: UserTransaction[] }`
- `UserTransaction` — строка из `view_user_transactions`: event_date, event_type, source, coins, description, created_at
- `AdminOrderRow` — заказ с user_name, user_email, product_name, product_emoji, product_image_url, is_physical, coins_spent, status, note, status_changed_by, status_changed_at
- `UpdateOrderStatusInput` — Zod-схема: orderId (uuid), status (pending/processing/fulfilled), note (optional)
- `CancelOrderInput` — Zod-схема: orderId (uuid), note (optional, max 500)
- `ProductFormData` — данные формы товара: name, description, price, category_id, image_url, emoji, stock, sort_order

## Actions

- `updateEventType({ key, name?, coins?, description?, is_active? })` — обновляет поля события. Revalidate: `/admin/events`
- `toggleAdmin(userId)` — переключает is_admin у пользователя. Revalidate: `/admin/users`
- `updateOrderStatus({ orderId, status, note? })` — смена статуса заказа (кроме cancelled). Revalidate: `/admin/orders`, `/store/orders`
- `cancelOrder({ orderId, note? })` — отмена заказа с возвратом коинов через RPC `cancel_order`. Revalidate: `/admin/orders`, `/store/orders`, `/store`, `/profile`

## Queries

- `getEventTypes()` — все event types, сортировка по coins DESC
- `getUsers()` — все активные сотрудники с балансом (ws_users LEFT JOIN gamification_balances)
- `getUserDetail(userId)` — пользователь + последние 50 транзакций из view_user_transactions
- `getOrders()` — все заказы с данными покупателя, товара (name, emoji, image_url, is_physical через category) и суммой. supabaseAdmin

## Компоненты

- `AdminNav` — навигация по разделам админки (табы: Overview, Events, Users, Products, Orders)
- `EventTypesTable` — таблица событий с inline-редактированием (name, coins, description), table-layout: fixed
- `AdminUsersClient` — обёртка над UsersTable, принимает `AdminUserRow[]`
- `UsersTable` — таблица пользователей с поиском, фильтрацией по отделу, тогглом «только админы», группировкой по отделам/командам, inline-переключением ролей
- `RoleToggle` — контекст-компонент для управления ролями: `RoleProvider` (state + optimistic), `RoleBadge` (отображение), `RoleSwitch` (интерактивный тоггл)
- `UserDetailModal` — боковая панель с деталями пользователя и последними 50 транзакциями. Загружает данные через API route `/api/admin/user-detail`
- `ProductsClient` — управление товарами и категориями: inline-редактирование, поиск, фильтрация по категориям (динамический overflow пиллов), удаление товаров, создание/редактирование через модалку
- `ProductFormModal` — модалка создания/редактирования товара: кастомный дропдаун категории, эмодзи-инпут (Win+.), drag-and-drop загрузка изображений, блокировка скролла. Рендерится через портал
- `AdminOrdersClient` — управление заказами: дропдаун статуса на бейдже (через портал, вложенный `StatusDropdown` с позиционированием через useRef), кнопка отмены, раскрываемые комментарии, модал подтверждения отмены (через портал)
- `AdminPlaceholder` — заглушка для неактивных разделов
- `AdminTableSkeleton` — скелетон загрузки таблиц

## Утилиты

- `checkIsAdmin()` — декодирует JWT, возвращает boolean. Используется во всех админских actions

## UI-паттерны

- Все toast-уведомления рендерятся через `createPortal(…, document.body)` — обход transform containing block от анимаций
- Модалки рендерятся через портал (backdrop на весь экран)
- Дропдауны (статус заказа, тип категории) рендерятся через портал с `position: fixed` — не обрезаются overflow: hidden
- Inline-редакторы закрываются при клике вне поля (onBlur с проверкой relatedTarget)
- Таблицы используют `table-layout: fixed` с `<colgroup>` для стабильных колонок при inline-редактировании
- Тоггл статуса товара блокируется (disabled + opacity 0.4) при неактивной категории

## API Routes

- `GET /api/admin/user-detail?id={userId}` — детали пользователя для `UserDetailModal`. Guard: `checkIsAdmin()` → 403. Возвращает `UserDetail` JSON или 404
- `POST /api/admin/upload-product-image` — загрузка изображения товара. Guard: `checkIsAdmin()` → 403. FormData с полем `file`. Валидация: JPEG/PNG/WebP, max 2 МБ. Storage path: `products/{timestamp}_{uuid}.{ext}`. Возвращает публичный URL

## Страницы

- `/admin` — layout с заголовком и `AdminNav`. Главная — placeholder
- `/admin/events` — `getEventTypes()` → `EventTypesTable`
- `/admin/users` — `getUsers()` → `AdminUsersClient`
- `/admin/users/[id]` — `getUserDetail(id)` → детальная страница пользователя с `RoleProvider`, информационными карточками, списком транзакций. 404 если не найден
- `/admin/products` — `getAllProducts()` + `getAllCategories()` параллельно → `ProductsClient`
- `/admin/orders` — `getOrders()` → `AdminOrdersClient`

Все страницы с данными имеют `loading.tsx` со скелетонами.

## Ограничения

- Админ не может добавлять/удалять event types — только менять coins
- Отмена заказа: любой статус кроме `cancelled`. Коины возвращаются через RPC `cancel_order`
- Смена статуса на `cancelled` только через `cancelOrder` (не через `updateOrderStatus`)
- Нефизические товары: статус заказа не меняется через дропдаун, только отмена
- Удаление товара запрещено при наличии заказов
- Slug категории: `^[a-z][a-z0-9_]*$`, уникальный среди категорий
