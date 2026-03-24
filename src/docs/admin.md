# admin

Админ-панель для управления системой геймификации: события, пользователи, товары, заказы.

## Логика работы

Все actions проверяют `is_admin` через `checkIsAdmin()` — декодирование JWT access_token. Админские actions используют `supabaseAdmin` (service role, обходит RLS) — защита на уровне кода через `checkIsAdmin()`. Пользовательские actions (покупка и т.д.) используют обычный клиент + RLS.

Админ может менять стоимость событий (coins) в `gamification_event_types`. Добавление/удаление event types запрещено — они создаются в миграциях и привязаны к триггерам/скриптам.

Управление заказами: смена статуса (pending/processing/fulfilled), отмена с возвратом коинов через RPC `cancel_order`.

## Зависимости

- `gamification_event_types` — справочник событий (SELECT для authenticated, UPDATE для админов)
- `ws_users` — справочник сотрудников (is_admin)
- `shop_orders` — заказы (JOIN с ws_users, shop_products, gamification_transactions)
- `custom_access_token_hook` — pg-функция, добавляет `is_admin` и `ws_user_id` в JWT
- Модули: `auth` (getCurrentUser), `shop` (CancelResult type)

## Типы

- `EventTypeRow` — строка из `gamification_event_types`: key, name, coins, description, is_active
- `UpdateEventTypeInput` — Zod-схема: key (string, обязателен), name (string, опционален), coins (int, опционален), description (string | null, опционален), is_active (boolean, опционален)
- `AdminOrderRow` — заказ с user_name, user_email, product_name, product_emoji, coins_spent, status, note
- `UpdateOrderStatusInput` — Zod-схема: orderId (uuid), status (pending/processing/fulfilled), note (optional)

## Actions

- `updateEventType({ key, name?, coins?, description?, is_active? })` — обновляет поля события (любую комбинацию). Проверяет isAdmin. Revalidate: `/admin/events`
- `toggleAdmin(userId)` — переключает is_admin у пользователя. Проверяет isAdmin. Revalidate: `/admin/users`
- `updateOrderStatus({ orderId, status, note? })` — смена статуса заказа (кроме cancelled). Проверяет isAdmin. Revalidate: `/admin/orders`, `/store/orders`
- `cancelOrder({ orderId, note? })` — отмена заказа с возвратом коинов через RPC `cancel_order`. Проверяет isAdmin. Revalidate: `/admin/orders`, `/store/orders`, `/store`, `/profile`

## Queries

- `getEventTypes()` — все event types, сортировка по coins DESC
- `getUsers()` — все активные сотрудники с балансом (ws_users LEFT JOIN gamification_balances)
- `getUserDetail(userId)` — пользователь + последние 50 транзакций из view_user_transactions
- `getOrders()` — все заказы с данными покупателя, товара и суммой (JOIN ws_users, shop_products, gamification_transactions). supabaseAdmin

## Утилиты

- `checkIsAdmin()` — декодирует JWT, возвращает boolean. Используется во всех админских actions

## Ограничения

- Админ не может добавлять/удалять event types — только менять coins
- В будущем: события с `is_dynamic_coins = true` будут заблокированы для редактирования
- Отмена заказа: любой статус кроме `cancelled`. Коины возвращаются через RPC `cancel_order`
- Смена статуса на `cancelled` только через `cancelOrder` (не через `updateOrderStatus`)
