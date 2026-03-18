# WS Gamification — План

## Обзор

Система геймификации на основе данных Worksection. Отслеживает ежедневные отчёты времени, динамику прогресса задач, дисциплину разделов и соблюдение бюджета. Конкретные суммы баллов пока игнорируются — важен только факт события.

## Иерархия (WS)

```
Проект
  └── L1 (позиция по Генплану) — игнорируется
        └── L2 (раздел) — ответственный = тимлид
              └── L3 (задача) — ответственный = исполнитель
```

L1 прозрачен — сохраняем только L2 и L3. В WS L2.parent = L1, но мы пропускаем L1 и связываем L3 → L2 напрямую.

## Источники данных (WS API)

| Эндпоинт                                  | Данные                                                       | Частота синка |
| ----------------------------------------- | ------------------------------------------------------------ | ------------- |
| `get_users`                               | Все пользователи WS (имя, отдел, команда, роль)              | 2 раза/день   |
| `get_projects` (filter=active, тег синка) | Активные проекты                                             | 1 раз/день    |
| `get_tasks` (extra=subtasks) по проекту   | Дерево задач: L1→L2→L3, статус, теги, %, max_time, даты      | 1 раз/день    |
| `get_tasks` для проекта отсутствий        | Задачи отсутствий (отпуск, больничный, отгул) по сотрудникам | 1 раз/день    |
| `get_costs` (datestart/dateend)           | Записи времени: пользователь + задача + день                 | 1 раз/день    |

## Отсутствия

Отдельный проект в WS содержит задачи, назначенные на сотрудников: «В отпуске», «На больничном», «Отгул» и т.д. Синк парсит название/теги задачи для определения типа отсутствия и диапазона дат (date_start — date_end).

---

## Схема БД

### 1. ✅ `ws_users` — справочник пользователей WS (синк 2 раза/день)

Подробности: [sync-users.md](./✔sync-users.md)

### 2. ✅ `ws_projects` — проекты с тегом синка (синк 1 раз/день)

| Колонка       | Тип                       | Описание              |
| ------------- | ------------------------- | --------------------- |
| id            | uuid PK                   |                       |
| ws_project_id | text UNIQUE NOT NULL      |                       |
| name          | text NOT NULL             |                       |
| status        | text NOT NULL             | 'active' / 'archived' |
| synced_at     | timestamptz DEFAULT now() |                       |

При переносе проекта в «Архив» — статус меняется на 'archived', все проверки бюджета и отзывы баллов по этому проекту прекращаются.

### 3a. ✅ `ws_tasks_l2` — разделы (синк 1 раз/день)

L2 — раздел проекта. Ответственный = тимлид. Участвует в правиле 3 (дисциплина разделов) и правиле 4 (бюджет L2).

| Колонка        | Тип                       | Описание                                             |
| -------------- | ------------------------- | ---------------------------------------------------- |
| id             | uuid PK                   |                                                      |
| ws_task_id     | text UNIQUE NOT NULL      | ID задачи в WS                                       |
| ws_project_id  | text NOT NULL             | FK → ws_projects.ws_project_id                       |
| parent_l1_id   | text NULL                 | ID родительской L1-задачи в WS (для справки, без FK) |
| parent_l1_name | text NULL                 | Название родительской L1-задачи (для справки)        |
| name           | text NOT NULL             |                                                      |
| assignee_id    | uuid NULL                 | FK → ws_users.id (тимлид раздела, NULL при noone)    |
| assignee_email | text NULL                 | Email тимлида (денормализация, NULL при noone)       |
| max_time       | numeric NULL              | Плановый бюджет (часы)                               |
| date_closed    | timestamptz NULL          | Когда раздел был фактически закрыт                   |
| synced_at      | timestamptz DEFAULT now() |                                                      |

### 3b. ✅ `ws_tasks_l3` — задачи (синк 1 раз/день)

L3 — конкретная задача. Ответственный = исполнитель. Участвует в правиле 2 (динамика), правиле 4 (бюджет L3), правиле 5 (мастер планирования).

| Колонка        | Тип                       | Описание                                          |
| -------------- | ------------------------- | ------------------------------------------------- |
| id             | uuid PK                   |                                                   |
| ws_task_id     | text UNIQUE NOT NULL      | ID задачи в WS                                    |
| ws_project_id  | text NOT NULL             | FK → ws_projects.ws_project_id                    |
| parent_l2_id   | text NOT NULL             | FK → ws_tasks_l2.ws_task_id (родительский раздел) |
| name           | text NOT NULL             |                                                   |
| assignee_id    | uuid NULL                 | FK → ws_users.id (NULL при noone / неизвестном)   |
| assignee_email | text NULL                 | Email исполнителя (NULL при noone)                |
| percent        | smallint NULL             | Значение тега % (0-100)                           |
| max_time       | numeric NULL              | Плановый бюджет (часы)                            |
| date_closed    | timestamptz NULL          | Когда задача была фактически закрыта              |
| synced_at      | timestamptz DEFAULT now() |                                                   |

### 3c. ✅ `ws_task_budget_checkpoints` — вычисляемое состояние чекпоинтов (управляется compute-gamification)

Отдельная таблица для отслеживания прогресса контрольных точек бюджета. Не затрагивается синком — только `compute-gamification`.

| Колонка               | Тип                         | Описание                                                        |
| --------------------- | --------------------------- | --------------------------------------------------------------- |
| id                    | uuid PK                     |                                                                 |
| ws_task_id            | text UNIQUE NOT NULL        | FK → ws_tasks_l3.ws_task_id                                     |
| last_checkpoint       | smallint NOT NULL DEFAULT 0 | Последняя пройденная контрольная точка (0, 20, 40, 60, 80, 100) |
| percent_at_checkpoint | smallint NULL               | Значение метки % на момент установки чекпоинта                  |
| updated_at            | timestamptz DEFAULT now()   |                                                                 |

### 4a. ✅ `ws_daily_reports` — ежедневные отчёты пользователей (синк 1 раз/день)

| Колонка     | Тип                       | Описание                            |
| ----------- | ------------------------- | ----------------------------------- |
| id          | uuid PK                   |                                     |
| user_id     | uuid NULL                 | FK → ws_users.id                    |
| user_email  | text NOT NULL             | Кто внёс время                      |
| report_date | date NOT NULL             | День отчёта                         |
| total_hours | numeric NOT NULL          | Суммарные часы за день (все задачи) |
| synced_at   | timestamptz DEFAULT now() |                                     |

UNIQUE(user_email, report_date)

Источник: `get_costs` за вчера → агрегация по user_email + date.
Используется для правила 1: внёс ли пользователь хоть какое-то время за день.

Синк **только за вчера**, один раз в сутки. Старые дни не пересинкиваются. Если юзер внёс отчёт задним числом после синка — запись не появится, `view_daily_statuses` останется red. Это намеренное поведение: факт отсутствия отчёта фиксируется на момент синка.

### 4b. ✅ `ws_task_actual_hours` — фактические часы по задаче L3 (синк 1 раз/день)

| Колонка     | Тип                       | Описание                                             |
| ----------- | ------------------------- | ---------------------------------------------------- |
| id          | uuid PK                   |                                                      |
| ws_task_id  | text UNIQUE NOT NULL      | FK → ws_tasks_l3.ws_task_id                          |
| total_hours | numeric NOT NULL          | Суммарные часы по задаче (все пользователи, все дни) |
| synced_at   | timestamptz DEFAULT now() |                                                      |

Источник: `get_costs` без datestart/dateend (всё время) → агрегация по task_id, фильтр по L3.
Полностью перезаписывается при каждом синке — всегда актуальные данные, включая отчёты задним числом.

Используется для:

- Правило 2: `budget_percent = (total_hours / max_time) * 100` → пересечена ли контрольная точка
- Правило 4: `total_hours <= max_time` → задача L3 закрыта в рамках бюджета?

### 4c. `ws_task_actual_hours_l2` — фактические часы, залогированные напрямую на раздел L2 (синк 1 раз/день)

| Колонка     | Тип                       | Описание                                                           |
| ----------- | ------------------------- | ------------------------------------------------------------------ |
| id          | uuid PK                   |                                                                    |
| ws_task_id  | text UNIQUE NOT NULL      | FK → ws_tasks_l2.ws_task_id                                       |
| total_hours | numeric NOT NULL          | Часы, залогированные напрямую на L2 (не включая дочерние L3)       |
| synced_at   | timestamptz DEFAULT now() |                                                                    |

Источник: `get_costs` без datestart/dateend (всё время) → агрегация по task_id, фильтр по L2.
Полностью перезаписывается при каждом синке.

Используется для:

- Правило 4: полный бюджет раздела L2 = `ws_task_actual_hours_l2.total_hours` (часы на самом L2) + `SUM(ws_task_actual_hours.total_hours)` по дочерним L3

### 5. ✅ `ws_task_percent_snapshots` — ежедневный снапшот % (создаётся при синке)

| Колонка       | Тип           | Описание             |
| ------------- | ------------- | -------------------- |
| id            | uuid PK       |                      |
| ws_task_id    | text NOT NULL |                      |
| percent       | smallint NULL | % на момент снапшота |
| snapshot_date | date NOT NULL |                      |

UNIQUE(ws_task_id, snapshot_date)

Используется для правила 2: определить, менялась ли метка % между контрольными точками бюджета. Сканируем снапшоты в промежутке между двумя чекпоинтами — если хотя бы в одном снапшоте percent отличается от percent_at_checkpoint, метка менялась.

### 6. ✅ `ws_user_absences` — отпуск / больничный / сикдей (синк 1 раз/день)

| Колонка      | Тип           | Описание                               |
| ------------ | ------------- | -------------------------------------- |
| id           | uuid PK       |                                        |
| user_id      | uuid NULL     | FK → ws_users.id (NULL если не найден) |
| user_email   | text NOT NULL |                                        |
| absence_type | text NOT NULL | 'vacation' / 'sick_leave' / 'sick_day' |
| absence_date | date NOT NULL | Один день                              |
| synced_at    | timestamptz   |                                        |

UNIQUE(user_email, absence_date, absence_type)

Два источника:

- **get_users_schedule** → `vacation` (отпуск), `sick_leave` (больничный с справкой). Возвращает отдельные даты, записываются как есть. `workday` игнорируется.
- **get_tasks** для проекта 129965, L1 задача 4905680 → дочерние L2 задачи = `sick_day` (оплачиваемый больничный без справки, 1-2 дня). Диапазон date_start→date_end разворачивается в отдельные строки по дням.

Edge Function: `sync-ws-absences`. Старые записи не перезаписываются (`ignoreDuplicates: true`), новые дописываются.

Используется для: правило 1 (пропуск красного дня), правило 5 (заморозка стриков).

### 7. ✅ `ws_user_streaks` — хранимый счётчик стриков (управляется compute-gamification)

| Колонка        | Тип                              | Описание                                    |
| -------------- | -------------------------------- | ------------------------------------------- |
| user_id        | uuid PK, FK → ws_users.id       |                                             |
| current_streak | integer NOT NULL DEFAULT 0       | Текущее количество зелёных дней подряд      |
| longest_streak | integer NOT NULL DEFAULT 0       | Максимальный стрик (для статистики/UI)      |
| updated_at     | timestamptz NOT NULL DEFAULT now() |                                           |

Логика обновления (в `compute-gamification`, после вычисления дневного статуса):
- `green_day` → `current_streak += 1`, `longest_streak = max(longest_streak, current_streak)`
- `red_day` → `current_streak = 0`
- `absent` → ничего не меняем

Проверка вех: `if current_streak in (7, 30, 90)` → создаём событие `ws_streak_7` / `ws_streak_30` / `ws_streak_90`.

### 8. ✅ `view_daily_statuses` — VIEW: зелёный / красный / отсутствует по дням

Не таблица, а view. Вычисляется из `ws_daily_reports`, `ws_user_absences`, `gamification_event_logs`, `ws_users`.

| Колонка      | Тип       | Описание                                                     |
| ------------ | --------- | ------------------------------------------------------------ |
| user_id      | uuid      | FK → ws_users.id                                             |
| user_email   | text      |                                                              |
| date         | date      | День                                                         |
| status       | text      | `'green'` / `'red'` / `'absent'`                            |
| absence_type | text NULL | `'vacation'` / `'sick_leave'` / `'sick_day'` (только absent) |
| red_reasons  | text[] NULL | Массив event_type, вызвавших красный день                  |

Логика приоритетов (absent всегда перекрывает red):

1. Есть запись в `ws_user_absences` на эту дату → **absent** (независимо от остального)
2. Нет записи в `ws_daily_reports` → **red** (не внёс время), red_reasons = `['red_day']`
3. Есть негативные события в `gamification_event_logs` (`task_dynamics_violation`, `section_red`) → **red**, red_reasons = array_agg(event_type)
4. Иначе → **green**

### 9. ✅ `gamification_event_logs` — универсальный лог событий (все источники)

| Колонка         | Тип                       | Описание                                                    |
| --------------- | ------------------------- | ----------------------------------------------------------- |
| id              | uuid PK                   |                                                             |
| user_id         | uuid NOT NULL             | FK → ws_users.id (на кого влияет)                           |
| user_email      | text NOT NULL             | Email пользователя (денормализация для быстрых запросов)    |
| event_type      | text NOT NULL             | FK → gamification_event_types.key                           |
| source          | text NOT NULL             | Источник: `ws`, `revit`, `airtable`, `planning`, `shop`    |
| event_date      | date NOT NULL             | Когда произошло событие                                     |
| details         | jsonb NULL                | Контекст события (discriminated union по source, см. ниже)  |
| idempotency_key | text UNIQUE NULL          | Ключ идемпотентности для защиты от дублей                   |
| created_at      | timestamptz DEFAULT now() |                                                             |

Формат `idempotency_key` по источникам:
- WS: `ws_green_day_{user_id}_{date}`, `ws_dynamics_{ws_task_id}_{checkpoint}`, `ws_section_red_{ws_l2_id}_{date}`, `ws_budget_ok_l3_{ws_task_id}`
- Revit: `revit_green_{email}_{date}`, `revit_streak_7_{email}_{date}`
- Airtable: `gratitude_{airtable_id}`

Формат `details` зависит от `source` (типизируется в коде как discriminated union):

| source | Поля details | Пример |
| --- | --- | --- |
| `ws` | ws_task_id, ws_task_name, ws_project_id, ws_l2_id, ws_l1_id, checkpoint, budget_percent, percent, max_time, actual_time, streak_was, violator_email, violation_type | `{ "ws_task_id": "123", "ws_task_name": "Чертежи фасадов", "ws_project_id": "456", "ws_l2_id": "789", "ws_l1_id": "012", "checkpoint": 20, "budget_percent": 22 }` |
| `revit` | plugin_name, launch_count | `{ "plugin_name": "WallPlugin", "launch_count": 5 }` |
| `airtable` | gratitude_id, sender_email | `{ "gratitude_id": "rec123", "sender_email": "ivan@co.ua" }` |
| `planning` | team, days_overdue | `{ "team": "AR-1", "days_overdue": 10 }` |
| `shop` | item_name | `{ "item_name": "Вторая жизнь" }` |

### 10. ✅ `gamification_event_types` — справочник типов событий и их стоимости

| Колонка     | Тип                              | Описание                                           |
| ----------- | -------------------------------- | -------------------------------------------------- |
| key         | text PK                         | Уникальный ключ типа события (`green_day` и т.д.)  |
| coins       | integer NOT NULL                | Количество коинов (+ начисление, − списание)        |
| description | text NULL                       | Описание события                                    |
| is_active   | boolean NOT NULL DEFAULT true   | Активен ли тип                                      |
| created_at  | timestamptz NOT NULL DEFAULT now() |                                                   |
| updated_at  | timestamptz NOT NULL DEFAULT now() |                                                   |

Справочник управляется вручную (админка или миграции). `compute-gamification` читает стоимость из этой таблицы при создании транзакций.

### 11. ✅ `gamification_transactions` — история начислений/списаний коинов

| Колонка    | Тип                       | Описание                                   |
| ---------- | ------------------------- | ------------------------------------------ |
| id         | uuid PK                   |                                            |
| user_id    | uuid NOT NULL             | FK → ws_users.id                           |
| user_email | text NOT NULL             | На кого начислено/списано                  |
| event_id   | uuid NOT NULL UNIQUE      | FK → gamification_event_logs.id (1 событие = 1 транзакция) |
| coins      | integer NOT NULL          | Количество коинов (+ или −)               |
| created_at | timestamptz DEFAULT now() |                                            |

Каждая транзакция привязана к конкретному событию. Стоимость берётся из `gamification_event_types` на момент создания транзакции.

Процесс создания транзакции (в `compute-gamification`):

Все шаги выполняются в одной SQL-транзакции (BEGIN/COMMIT) — либо всё записалось, либо ничего:

1. INSERT событие в `gamification_event_logs`
2. Читаем `coins` из `gamification_event_types` по `event_type`
3. INSERT в `gamification_transactions` (event_id, coins)
4. UPDATE `gamification_balances` SET `total_coins += coins`

### 12. ✅ `gamification_balances` — материализованный баланс коинов

| Колонка     | Тип                                | Описание         |
| ----------- | ---------------------------------- | ---------------- |
| user_id     | uuid PK, FK → ws_users.id         |                  |
| total_coins | integer NOT NULL DEFAULT 0         | Текущий баланс   |
| updated_at  | timestamptz NOT NULL DEFAULT now() |                  |

Источник правды — `gamification_transactions`. Баланс = `SUM(coins)` из транзакций. Таблица `gamification_balances` — кэш для быстрого чтения (профиль, лидерборд, проверка покупок в магазине).

Обновление: атомарно вместе с INSERT в `gamification_transactions` (в одной SQL-транзакции). Если баланс рассинхронизировался — можно пересчитать:

```sql
UPDATE gamification_balances b
SET total_coins = (SELECT COALESCE(SUM(coins), 0) FROM gamification_transactions t WHERE t.user_id = b.user_id),
    updated_at = now();
```

Используется для:
- UI профиля — показать текущий баланс без агрегации
- Лидерборд — ORDER BY total_coins DESC (индексируемый)
- Магазин артефактов — проверка `total_coins >= item_cost` перед покупкой

### 13. ✅ `budget_pending` — задачи, ожидающие 30-дневной проверки бюджета

| Колонка        | Тип                             | Описание                                             |
| -------------- | ------------------------------- | ---------------------------------------------------- |
| id             | uuid PK                         |                                                      |
| ws_task_l2_id  | text NULL                       | FK → ws_tasks_l2.ws_task_id (заполнен для L2)        |
| ws_task_l3_id  | text NULL                       | FK → ws_tasks_l3.ws_task_id (заполнен для L3)        |
| assignee_id    | uuid NOT NULL                   | FK → ws_users.id                                     |
| assignee_email | text NOT NULL                   | Ответственный на момент закрытия                     |
| closed_at      | timestamptz NOT NULL            | Когда задача была закрыта                            |
| eligible_date  | date NOT NULL                   | closed_at + 30 дней                                  |
| status         | text NOT NULL DEFAULT 'pending' | 'pending' / 'approved' / 'revoked'                   |
| checked_at     | timestamptz NULL                | Когда была выполнена проверка                        |

CHECK: ровно один из `ws_task_l2_id` / `ws_task_l3_id` NOT NULL.
UNIQUE: на каждый заполненный FK (чтобы задача не дублировалась в pending).

Процесс:

1. Задача закрывается → вставляем строку с status='pending', eligible_date = closed_at + 30 дней
2. Задача переоткрывается до eligible_date → удаляем строку (событие не создаётся)
3. Наступает eligible_date → считаем бюджет: SUM(hours) из ws_task_actual_hours <= max_time?
   - Да → status='approved', создаём событие budget_ok
   - Нет → status='revoked', создаём событие budget_exceeded
4. Задача переоткрывается ПОСЛЕ approved → перепроверяем при следующем закрытии (eligible_date пересчитывается с нуля)
5. Проект в архиве пока pending → сразу approved, коины начисляются
6. Ежедневная проверка approved-строк (часы могут быть дописаны в закрытую задачу):
   - Для каждой строки с status='approved' пересчитываем actual_hours из ws_task_actual_hours
   - Если actual_hours > max_time → status='revoked', создаём событие budget_revoked_l3/l2, отзываем коины у ответственного L3 и бонусные коины у ответственного L2

### 14. ✅ `view_user_transactions` — VIEW: полная история начислений/списаний

Джойн `gamification_transactions` + `gamification_event_logs` + `gamification_event_types`. Показывает юзеру "где мои баллы".

| Колонка     | Тип       | Описание                                          |
| ----------- | --------- | ------------------------------------------------- |
| user_id     | uuid      |                                                   |
| user_email  | text      |                                                   |
| event_date  | date      | Когда произошло событие                           |
| event_type  | text      | `budget_ok_l3`, `ws_streak_7`...                  |
| source      | text      | `ws`, `revit`, `airtable`...                      |
| coins       | integer   | +25 / -30                                         |
| description | text      | Из event_types ("Бонус за стрик 7 дней")          |
| details     | jsonb     | Контекст (название задачи, id проекта и т.д.)     |
| created_at  | timestamptz |                                                 |

### 15. ✅ `view_budget_pending_status` — VIEW: ожидающие и завершённые проверки бюджета

Джойн `budget_pending` + `ws_tasks_l2` / `ws_tasks_l3` + `ws_projects` + `ws_task_actual_hours` + `gamification_event_types`. Показывает юзеру "что мне скоро придёт" и "что уже начислено/отклонено".

| Колонка        | Тип       | Описание                                                  |
| -------------- | --------- | --------------------------------------------------------- |
| user_id        | uuid      | Ответственный                                             |
| user_email     | text      |                                                           |
| status         | text      | `'pending'` / `'approved'` / `'revoked'`                 |
| level          | text      | `'L2'` / `'L3'`                                          |
| ws_task_l2_id  | text      | ID задачи L2                                              |
| ws_task_l3_id  | text      | ID задачи L3 (NULL для L2)                                |
| ws_project_id  | text      | ID проекта                                                |
| ws_l1_id       | text      | ID задачи L1 (для ссылки в WS)                            |
| task_name      | text      | Название задачи                                           |
| project_name   | text      | Название проекта                                          |
| max_time       | numeric   | Плановый бюджет (часы)                                    |
| actual_hours   | numeric   | Фактические часы (живой расчёт из ws_task_actual_hours)   |
| within_budget  | boolean   | `actual_hours <= max_time` (текущий прогноз)              |
| closed_at      | timestamptz | Когда задача была закрыта                               |
| eligible_date  | date      | Когда будет проверка                                      |
| days_remaining | integer   | `eligible_date - CURRENT_DATE` (NULL для завершённых)     |
| expected_coins | integer   | Ожидаемые коины из event_types (budget_ok_l3 / budget_ok_l2) |
| checked_at     | timestamptz | Когда была выполнена проверка (NULL для pending)        |

UI-подсказки для view_budget_pending_status:
- `days_remaining < 0` и `status = 'pending'` → "Коины уже в пути!"
- `within_budget = false` и `status = 'pending'` → "Вы могли получить X коинов, но бюджет задачи превышен на Y часов("

### Граничные случаи (budget_pending)

- `max_time IS NULL` или `max_time = 0` → пропускаем, запись в pending не создаётся
- `ws_task_actual_hours` нет для задачи → коины не начисляются
- `assignee = NULL` (noone) → пропускаем, некому начислять
- Многократное переоткрытие → eligible_date пересчитывается с нуля каждый раз, абьюз не критичен
- L2 не может быть закрыт, пока открыты L3 внутри (ограничение WS)
- Проект архивирован пока pending → сразу approved, коины начисляются, юзер уведомляется
- Часы дописаны после approval → если бюджет превышен, коины отзываются: у ответственного L3 (budget_revoked_l3) и у ответственного L2 (за бонус дочерней L3)
- Задача удалена из синка → budget_pending сохраняет данные, начисление и отображение работают по сохранённым данным
- Смена ответственного → коины получает последний assignee на момент закрытия (вариант A)

### Потенциальное улучшение: пропорциональное распределение коинов при смене ответственного

Сейчас коины получает только последний ответственный. В будущем можно распределять пропорционально вкладу в % готовности задачи.

Потребуется таблица `ws_task_assignment_history`:

| Колонка       | Тип            | Описание                              |
| ------------- | -------------- | ------------------------------------- |
| id            | uuid PK        |                                       |
| ws_task_id    | text NOT NULL  | FK → ws_tasks_l3.ws_task_id           |
| user_id       | uuid NOT NULL  | FK → ws_users.id                      |
| user_email    | text NOT NULL  |                                       |
| percent_start | smallint NOT NULL | % задачи при назначении            |
| percent_end   | smallint NULL  | % задачи при смене (NULL = текущий)   |
| assigned_at   | timestamptz NOT NULL |                                  |
| unassigned_at | timestamptz NULL | NULL = текущий ответственный        |

Логика: `sync-ws-tasks` при обнаружении смены assignee закрывает старую запись (percent_end, unassigned_at) и открывает новую. При закрытии задачи коины распределяются: `base_coins * (percent_end - percent_start) / 100` для каждого участника.

Нерешённые вопросы: округление дробных коинов, минимальная выплата, assignee с нулевым вкладом (% не менялся).

---

## Типы событий

| event_type                  | Правило | Триггер                                                 | details                                             |
| --------------------------- | ------- | ------------------------------------------------------- | --------------------------------------------------- |
| `green_day`                 | 1       | Пользователь внёс время за день                         | {}                                                  |
| `red_day`                   | 1       | Не внёс время, не отсутствует                           | {}                                                  |
| `streak_reset_timetracking` | 1       | Красный день → стрик обнуляется                         | { streak_was: N }                                   |
| `task_dynamics_violation`   | 2       | Бюджет пересёк контрольную точку, метка % не менялась   | { ws_task_id, checkpoint, budget_percent, percent } |
| `streak_reset_dynamics`     | 2       | Нарушение динамики → стрик ответственного обнуляется    | { ws_task_id }                                      |
| `section_red`               | 3       | Любой ответственный за L3 в секции L2 получил нарушение | { ws_task_id (L2), violator_email, violation_type } |
| `streak_reset_section`      | 3       | Секция красная → стрик тимлида обнуляется               | { ws_task_id (L2) }                                 |
| `budget_ok_l3`              | 4       | L3 закрыта в рамках бюджета, прошло 30 дней             | { ws_task_id, max_time, actual_time }               |
| `budget_ok_l2`              | 4       | L2 закрыт в рамках бюджета, прошло 30 дней              | { ws_task_id, max_time, actual_time }               |
| `budget_exceeded_l3`        | 4       | L3 закрыта с превышением бюджета                        | { ws_task_id, max_time, actual_time }               |
| `budget_exceeded_l2`        | 4       | L2 закрыт с превышением бюджета                         | { ws_task_id, max_time, actual_time }               |
| `budget_revoked_l3`         | 4       | Переоткрыта после одобрения, бюджет превышен            | { ws_task_id }                                      |
| `budget_revoked_l2`         | 4       | Переоткрыт после одобрения, бюджет превышен             | { ws_task_id }                                      |
| `ws_streak_7`               | 5       | 7 подряд зелёных дней                                   | {}                                                  |
| `ws_streak_30`              | 5       | 30 подряд зелёных дней                                  | {}                                                  |
| `ws_streak_90`              | 5       | 90 подряд зелёных дней                                  | {}                                                  |
| `master_planner`            | 5       | 10 задач L3 подряд закрыты в рамках бюджета             | {}                                                  |
| `master_planner_reset`      | 5       | L3 закрыта с превышением, серия сбрасывается            | { streak_was: N }                                   |

---

## Edge Functions

### 1. ✅ `sync-ws-users` (2 раза/день)

Подробности: [sync-users.md](./sync-users.md)

### 2. `sync-ws-data` (1 раз/день, основной синк)

Последовательность:

1. ✅ **Синк проектов**: `get_projects` → фильтр по тегу синка → upsert `ws_projects` (отдельная Edge Function `sync-ws-projects`)
2. ✅ **Синк задач**: по каждому проекту → `get_tasks(extra=subtasks,tags)` → разворачиваем L1→L2→L3 → upsert `ws_tasks_l2`, `ws_tasks_l3` (отдельная Edge Function `sync-ws-tasks`). noone и неизвестные юзеры сохраняются с assignee=NULL
3. **Синк записей времени** (отдельная Edge Function `sync-ws-costs`):
   - **4a** `ws_daily_reports`: `get_costs` за вчера → агрегация по user_email → upsert. Только 1 день, задним числом не учитывается
   - **4b** `ws_task_actual_hours`: `get_costs` за всё время → агрегация по task_id → upsert. Полная перезапись, всегда актуально
4. ✅ **Сохранение снапшотов задач**: текущий % из `ws_tasks_l3` → upsert в `ws_task_percent_snapshots` (отдельная Edge Function `snapshot-task-percent`)
5. ✅ **Синк отсутствий**: `get_users_schedule` + `get_tasks` (проект 129965, задача 4905680) → разворачиваем диапазоны дат → upsert `ws_user_absences` (отдельная Edge Function `sync-ws-absences`)

### 3. `compute-gamification` (1 раз/день, после sync-ws-data)

#### Шаг 1. Сбор нарушений за вчера

**1a. Тайм-трекинг (правило 1)**
Для каждого активного `ws_user`:
- Нет записи в `ws_daily_reports` за вчера → нарушение (факт: не внёс время)

**1b. Динамика задач (правило 2)**
Для каждой открытой L3 (`date_closed IS NULL`, `max_time > 0`):
- `budget_percent = (ws_task_actual_hours.total_hours / max_time) * 100`
- `current_checkpoint = min(floor(budget_percent / 20) * 20, 100)`
- Сравниваем с `ws_task_budget_checkpoints.last_checkpoint`
- Если `current_checkpoint > last_checkpoint`:
  - Проверяем `ws_task_percent_snapshots`: менялась ли метка % с момента предыдущего чекпоинта?
  - Не менялась → событие `task_dynamics_violation` на ответственного L3
  - Двигаем чекпоинт вперёд в любом случае (update `ws_task_budget_checkpoints`)

**1c. Дисциплина разделов (правило 3)**
Для каждого L2:
- Есть ли `task_dynamics_violation` из шага 1b у кого-то из ответственных L3 в этом разделе?
- Если да → событие `section_red` на тимлида L2

Все события пишутся в `gamification_event_logs` с `event_date = вчера`.

#### Шаг 2. Итоговый статус дня

Для каждого активного `ws_user`:
- Есть запись в `ws_user_absences` за вчера → **absent**, ничего не пишем
- Есть хотя бы одно нарушение (из 1a, 1b или 1c) → событие **`red_day`**
- Нет нарушений → событие **`green_day`**

#### Шаг 3. Обновление стриков

По итоговому статусу обновляем `ws_user_streaks`:
- **green** → `current_streak += 1`, `longest_streak = max(longest_streak, current_streak)`. Если `current_streak` = 7 / 30 / 90 → событие `ws_streak_7` / `ws_streak_30` / `ws_streak_90`
- **red** → `current_streak = 0`
- **absent** → без изменений

#### Шаг 4. Бюджет задач (правило 4)

**4a. Новые закрытия**
L3/L2 с `date_closed IS NOT NULL`, `max_time > 0`, `assignee IS NOT NULL`, которых нет в `budget_pending`:
→ insert с `eligible_date = closed_at + 30 дней`, `status = 'pending'`

**4b. Переоткрытые**
L3/L2 с `date_closed IS NULL`, но есть в `budget_pending`:
- `status = 'pending'` → удалить строку
- `status = 'approved'` → пометить для перепроверки при следующем закрытии

**4c. Подошёл срок**
`budget_pending` где `eligible_date <= today` и `status = 'pending'`:
- `actual_hours <= max_time` → событие `budget_ok_l3` / `budget_ok_l2`, `status = 'approved'`
- Иначе → событие `budget_exceeded_l3` / `budget_exceeded_l2`, `status = 'revoked'`

**4d. Ревизия approved**
Для всех `budget_pending` с `status = 'approved'`:
- Пересчитать `actual_hours` из `ws_task_actual_hours`
- Если `actual_hours > max_time` → событие `budget_revoked_l3` / `budget_revoked_l2`, `status = 'revoked'`

#### Шаг 5. Мастер планирования (правило 5)

Для каждого пользователя:
- Считаем последовательные `budget_ok_l3` в `gamification_event_logs` (без `budget_exceeded_l3` между ними)
- 10 подряд → событие `master_planner`
- Любой `budget_exceeded_l3` → событие `master_planner_reset`, счётчик в 0

#### Шаг 6. Транзакции

Для каждого нового события из шагов 1–5:
1. Читаем `coins` из `gamification_event_types` по `event_type`
2. Insert в `gamification_transactions`
3. Update `gamification_balances` (`total_coins += coins`)

Всё в одной SQL-транзакции на событие.

---

## Детали правил

### Правило 1: Итоговый статус дня

`red_day` и `green_day` — это итоговый результат всех проверок за день, а не отдельное правило.

```
для каждого активного ws_user:
  если есть запись в ws_user_absences за вчера → absent, пропускаем

  нарушения = []
  если НЕТ записи в ws_daily_reports за вчера → нарушения += "не внёс время"
  если есть task_dynamics_violation (правило 2) → нарушения += "метка не обновлена"
  если есть section_red (правило 3) → нарушения += "нарушение в разделе"

  если нарушения.length > 0 → событие red_day
  иначе → событие green_day
```

### Правило 2: Динамика задач (L3) — контрольные точки бюджета

Контрольные точки: **20%, 40%, 60%, 80%, 100%** от планового бюджета (max_time).
Между двумя соседними точками требуется минимум 1 обновление метки % готовности.

```
для каждой L3 задачи с date_closed IS NULL и max_time > 0:
  actual_hours = total_hours FROM ws_task_actual_hours WHERE ws_task_id = X
  budget_percent = (actual_hours / max_time) * 100
  current_checkpoint = floor(budget_percent / 20) * 20   // 0, 20, 40, 60, 80, 100
  current_checkpoint = min(current_checkpoint, 100)

  cp = ws_task_budget_checkpoints WHERE ws_task_id = X  // если нет строки — создаём с last_checkpoint=0

  если current_checkpoint > cp.last_checkpoint:
    // Пересечена новая контрольная точка — проверяем, менялась ли метка
    label_changed = EXISTS(ws_task_percent_snapshots
      WHERE ws_task_id = X
      AND percent != cp.percent_at_checkpoint
      AND snapshot_date > cp.updated_at)

    если НЕ label_changed:
      событие task_dynamics_violation для ответственного
      событие streak_reset_dynamics для ответственного

    // В любом случае двигаем чекпоинт вперёд
    UPDATE ws_task_budget_checkpoints SET
      last_checkpoint = current_checkpoint,
      percent_at_checkpoint = текущий percent задачи,
      updated_at = now()
```

Примеры:

- Бюджет на 18% → ничего не требуем (чекпоинт 0, не пересечён 20)
- Бюджет достиг 22% → пересечён чекпоинт 20. Проверяем: менялась ли метка в промежутке 0→20? Если нет → нарушение
- Бюджет скакнул с 20% до 66% за раз → current_checkpoint = 60. Проверяем: менялась ли метка в промежутке 20→60? Если нет → нарушение (одно, не два)
- Бюджет с 60% до 85% → пересечён чекпоинт 80. Проверяем промежуток 60→80

### Правило 3: Дисциплина разделов (L2)

Тимлид L2 получает красный день **только** при нарушении динамики задач (метка не обновлена). Отсутствие отчёта времени у ответственного L3 **не влияет** на тимлида.

```
для каждого раздела L2:
  l3_assignees = все assignee_email задач L3 в этом L2
  violations_today = любое событие за сегодня с типом task_dynamics_violation
    WHERE user_email in l3_assignees

  если violations_today:
    событие section_red для тимлида L2
```

### Правило 4: Соблюдение бюджета

```
при закрытии задачи (status стал 'done', date_closed установлен):
  actual = total_hours FROM ws_task_actual_hours WHERE ws_task_id = X
  insert budget_pending(eligible_date = date_closed + 30 дней)

при наступлении eligible_date:
  если проект в архиве → пропускаем
  actual = total_hours FROM ws_task_actual_hours WHERE ws_task_id = X
  если actual <= max_time → budget_ok, помечаем approved
  иначе → budget_exceeded, помечаем revoked

при переоткрытии задачи (status обратно 'active'):
  если budget_pending.status = 'pending' → удаляем строку
  если budget_pending.status = 'approved' →
    перепроверяем при следующем закрытии
```

### Правило 5: Стрики

Стрик зелёных дней хранится в `ws_user_streaks` (таблица 7). Обновляется в `compute-gamification` после вычисления дневного статуса:

```
green_day → current_streak += 1, longest_streak = max(longest_streak, current_streak)
red_day   → current_streak = 0
absent    → без изменений (absent не ломает стрик, но не считается в длину)
```

Вехи на 7, 30, 90 зелёных дней → событие ws_streak_N (проверяем `current_streak == N`).

Мастер планирования: по каждому пользователю считаем последовательные budget_ok_l3 события. При 10 → событие master_planner. Любой budget_exceeded_l3 → сброс счётчика, событие master_planner_reset.

---

## Открытые вопросы

1. **ID проекта отсутствий** — какой проект WS содержит задачи отсутствий? Нужен ID проекта или тег для его идентификации.
2. **Формат задач отсутствий** — как устроены задачи? Название = «В отпуске»? Теги? Как отличить отпуск от больничного от отгула?
3. **Идентификация L1** — как отличить L1 от L2 в дереве задач? По глубине (top-level = L1, child = L2, child.child = L3)? Или по тегам?
4. **Тег синка** — тот же тег «eneca.work sync» (ID 230964) для фильтрации проектов?
5. **Каких пользователей отслеживать** — всех пользователей WS, или только назначенных на задачи в проектах с тегом синка?
6. **Обнаружение переоткрытия** — сравниваем текущий ws_tasks.status с предыдущим синком. Нужно хранить предыдущий статус для обнаружения переходов done→active.
7. **Диапазон дат get_costs** — синкаем только вчера, или скользящее окно? Для правила 2 (бюджет %) нужны все исторические записи по задаче — при первом запуске нужен полный синк.
8. **Задачи без max_time** — если у L3 задачи нет планового бюджета (max_time = NULL), правило 2 пропускается. Верно?
