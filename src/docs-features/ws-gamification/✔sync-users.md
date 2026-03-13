# Синхронизация пользователей WS

## Обзор

Синк справочника пользователей из Worksection. Подтягиваем всех пользователей с их отделом, командой и ролью. Запуск 2 раза в сутки: днём и ночью.

## Источник данных

Эндпоинт: `get_users` (WS API).

Возвращаемые поля (используемые):

- `id` — ID пользователя в WS
- `email` — email
- `first_name`, `last_name`, `name` — имя, фамилия, полное имя
- `department` — название отдела
- `group` — название команды
- `role` — роль (owner, account admin, team admin, department admin, user, guest, reader)
- `title` — должность

## Таблица `ws_users`

| Колонка    | Тип                                | Описание                                     |
| ---------- | ---------------------------------- | -------------------------------------------- |
| id         | uuid PK                            |                                              |
| ws_user_id | text UNIQUE NOT NULL               | Поле `id` из WS API                          |
| email      | text UNIQUE NOT NULL               |                                              |
| first_name | text NOT NULL                      | Имя                                          |
| last_name  | text NOT NULL                      | Фамилия                                      |
| department | text NULL                          | Отдел (поле `department` из WS)              |
| team       | text NULL                          | Команда (поле `group` из WS)                 |
| is_active  | boolean NOT NULL DEFAULT true      | false = пользователь отсутствует в ответе WS |
| synced_at  | timestamptz NOT NULL DEFAULT now() | Время последнего обновления записи           |

## Логика синхронизации

Расписание: 2 раза в сутки (днём + ночью).

### Алгоритм

1. Получаем полный список пользователей из `get_users`
2. Для каждого пользователя из WS:
   - **Новый** (нет записи с таким ws_user_id) → INSERT
   - **Изменённый** (запись есть, но отличается любое из полей: first_name, last_name, email, department, team) → UPDATE только изменённых полей + synced_at
   - **Без изменений** → пропускаем, не трогаем
3. Для пользователей, которые есть в БД, но отсутствуют в ответе WS:
   - Помечаем `is_active = false`, обновляем `synced_at`
4. Для пользователей, которые вернулись в ответ WS после деактивации:
   - Помечаем `is_active = true`, обновляем данные

### Маппинг полей WS → БД

| WS API поле  | Колонка БД | Примечание             |
| ------------ | ---------- | ---------------------- |
| `id`         | ws_user_id |                        |
| `email`      | email      |                        |
| `first_name` | first_name |                        |
| `last_name`  | last_name  |                        |
| `department` | department |                        |
| `group`      | team       | В WS «group» = команда |

### Edge Function: `sync-ws-users`

```
1. GET get_users → ws_users_list[]
2. SELECT * FROM ws_users → db_users[]

3. ws_map = Map(ws_user_id → ws_user) из ws_users_list
4. db_map = Map(ws_user_id → db_user) из db_users

5. Новые (в ws_map, нет в db_map):
   → INSERT ws_users(ws_user_id, email, first_name, last_name, department, team, role, title)

6. Существующие (в обоих):
   → если любое поле отличается → UPDATE изменённых полей + synced_at
   → если is_active = false → UPDATE is_active = true + synced_at
   → иначе → пропускаем

7. Удалённые (в db_map, нет в ws_map):
   → если is_active = true → UPDATE is_active = false + synced_at
```
