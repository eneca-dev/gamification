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
- `AdminOrderRow` — заказ с user_name, user_email, product_name, product_emoji, product_image_url, is_physical, coins_spent, status, note
- `UpdateOrderStatusInput` — Zod-схема: orderId (uuid), status (pending/processing/fulfilled), note (optional)
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

- `AdminNav` — навигация по разделам админки (табы)
- `EventTypesTable` — таблица событий с inline-редактированием (name, coins, description), table-layout: fixed
- `AdminUsersClient` — таблица пользователей с поиском, переключением is_admin
- `UsersTable` — таблица пользователей с сортировкой
- `UserDetailModal` — модалка с деталями пользователя и транзакциями
- `ProductsClient` — управление товарами и категориями: inline-редактирование, поиск, фильтрация по категориям (динамический overflow пиллов), удаление товаров, создание/редактирование через модалку
- `ProductFormModal` — модалка создания/редактирования товара: кастомный дропдаун категории, эмодзи-инпут (Win+.), drag-and-drop загрузка изображений, блокировка скролла. Рендерится через портал
- `AdminOrdersClient` — управление заказами: дропдаун статуса на бейдже (через портал), кнопка отмены, раскрываемые комментарии, модал подтверждения отмены (через портал)
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

## Ограничения

- Админ не может добавлять/удалять event types — только менять coins
- Отмена заказа: любой статус кроме `cancelled`. Коины возвращаются через RPC `cancel_order`
- Смена статуса на `cancelled` только через `cancelOrder` (не через `updateOrderStatus`)
- Нефизические товары: статус заказа не меняется через дропдаун, только отмена
- Удаление товара запрещено при наличии заказов
- Slug категории: `^[a-z][a-z0-9_]*$`, уникальный среди категорий
