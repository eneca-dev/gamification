# admin

Админ-панель для управления системой геймификации: события, пользователи, товары, заказы.

## Логика работы

Все actions проверяют `is_admin` через `checkIsAdmin()` — декодирование JWT access_token. Админские actions используют `supabaseAdmin` (service role, обходит RLS) — защита на уровне кода через `checkIsAdmin()`. Пользовательские actions (покупка и т.д.) используют обычный клиент + RLS.

Админ может менять стоимость событий (coins) в `gamification_event_types`. Добавление/удаление event types запрещено — они создаются в миграциях и привязаны к триггерам/скриптам.

## Зависимости

- `gamification_event_types` — справочник событий (SELECT для authenticated, UPDATE для админов)
- `ws_users` — справочник сотрудников (is_admin)
- `custom_access_token_hook` — pg-функция, добавляет `is_admin` и `ws_user_id` в JWT

## Типы

- `EventTypeRow` — строка из `gamification_event_types`: key, name, coins, description, is_active
- `UpdateEventTypeInput` — Zod-схема: key (string, обязателен), name (string, опционален), coins (int, опционален), description (string | null, опционален), is_active (boolean, опционален)

## Actions

- `updateEventType({ key, name?, coins?, description?, is_active? })` — обновляет поля события (любую комбинацию). Проверяет isAdmin. Revalidate: `/admin/events`

## Queries

- `getEventTypes()` — все event types, сортировка по coins DESC

## Утилиты

- `checkIsAdmin()` — декодирует JWT, возвращает boolean. Используется во всех админских actions

## Ограничения

- Админ не может добавлять/удалять event types — только менять coins
- В будущем: события с `is_dynamic_coins = true` будут заблокированы для редактирования
