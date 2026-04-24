# gamification-db

Схема базы данных системы геймификации. Справочник сотрудников, данные из Worksection, Revit-плагины, благодарности, ядро геймификации (события, транзакции, балансы, стрики).

---

## Логика работы

💎 начисляются всем сотрудникам из `ws_users` по email, независимо от регистрации в приложении. Регистрация (OAuth через Worksection) связывает `auth.users` с `ws_users.user_id`, а триггер `trg_link_ws_user_on_profile_insert` автоматически связывает `profiles` с `ws_users`.

Два параллельных потока начислений:

**Поток 1 — PG-триггеры (Revit + благодарности):**

1. Edge functions синкают данные в `elk_plugin_launches` и `at_gratitudes`
2. Триггеры `trg_award_revit_points` / `trg_award_gratitude_points` мгновенно создают записи в `gamification_event_logs` → `gamification_transactions`, обновляют `gamification_balances` через inline UPSERT, обновляют `revit_user_streaks`

**Поток 2 — VPS-скрипты (Worksection):**

1. Оркестратор запускает 8 скриптов последовательно: sync-ws-users → sync-ws-projects → sync-ws-tasks → sync-ws-costs → snapshot-task-percent → sync-ws-absences → sync-task-events → compute-gamification
2. `compute-gamification` анализирует данные и создаёт записи в `gamification_event_logs` → `gamification_transactions` → `gamification_balances`
3. Скрипты находятся в репозитории **eneca-dev/gamification-vps-scripts** (`src/scripts/`)

---

## Зависимости

- **Supabase Auth** — `auth.users`: регистрация, сессии, `auth.uid()`, `auth.jwt()`
- **Worksection API** — источник `ws_users`, `ws_projects`, `ws_tasks_l2/l3`, `ws_daily_reports`, `ws_daily_report_tasks`, `ws_task_actual_hours`, `ws_task_status_changes`, `ws_user_absences`
- **Elasticsearch / Kibana** — источник `elk_plugin_launches`
- **Airtable** — источник `at_gratitudes`

---

## Cron-расписание (pg_cron)

| Расписание                              | Edge Function                   | Что делает                                                       |
| --------------------------------------- | ------------------------------- | ---------------------------------------------------------------- |
| `0 1 * * *` (01:00 UTC ежедневно)       | `sync-plugin-launches`          | Синк запусков Revit-плагинов из Elasticsearch                    |
| `0 */4 * * *` (каждые 4 часа)           | `sync-gratitudes`               | Синк благодарностей из Airtable                                  |
| `0 2 1 * *` (1 число месяца, 02:00 UTC) | `fn_award_department_contest()` | Начисление бонуса отделу-победителю по ревит-💎 за прошлый месяц |

WS-синки (`sync-ws-users`, `sync-ws-projects`, `sync-ws-tasks`, `sync-ws-costs`, `snapshot-task-percent`, `sync-ws-absences`, `sync-task-events`, `compute-gamification`) запускаются **VPS-оркестратором**, не через pg_cron.

---

## Вспомогательные SQL-функции

| Функция                                 | Что делает                                                                                                                                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `my_email()`                            | Email текущего пользователя из JWT, нижний регистр                                                                                                                                            |
| `my_ws_user_id()`                       | UUID из `ws_users` по email из JWT                                                                                                                                                            |
| `get_user_id_by_email(email)`           | UUID из `auth.users` по email                                                                                                                                                                 |
| `increment_balance(p_user_id, p_coins)` | Атомарный UPSERT баланса в `gamification_balances`. Устаревшая — заменена `process_gamification_event`. Триггеры делают inline UPSERT                                                         |
| `process_gamification_event(...)`       | Атомарная функция для VPS-скрипта: INSERT event + INSERT transaction + UPSERT balance в одной транзакции. Дубли по idempotency_key пропускаются. При отрицательном `p_coins` списание ограничено текущим балансом (clamp к 0) — в транзакцию пишется фактическая сумма, остаток долга теряется. SECURITY DEFINER, доступ только service_role |
| `link_ws_user_on_profile_insert()`      | Триггер: при создании `profiles` связывает с `ws_users.user_id`                                                                                                                               |
| `custom_access_token_hook(event)`       | Auth Hook: добавляет `is_admin` и `ws_user_id` из `ws_users` в JWT claims при каждом выпуске/рефреше токена                                                                                   |
| `fn_award_department_contest()`         | Ежемесячное начисление бонуса отделу-победителю по ревит-💎                                                                                                                                   |

---

## Таблицы

### Группа A: Справочник сотрудников и авторизация

#### `ws_users` (575 строк)

Мастер-список сотрудников. Синкается скриптом `sync-ws-users` из Worksection API. Центральная таблица — на неё ссылаются все gamification-таблицы через FK.

| Колонка           | Тип                    | Описание                                                             |
| ----------------- | ---------------------- | -------------------------------------------------------------------- |
| `id`              | uuid PK                |                                                                      |
| `ws_user_id`      | text UNIQUE            | ID в Worksection                                                     |
| `email`           | text UNIQUE            | Нижний регистр (CHECK). Ключ связи со всеми source-таблицами         |
| `first_name`      | text                   |                                                                      |
| `last_name`       | text                   |                                                                      |
| `department`      | text NULL              | Полное название: "(КР гражд) Конструктивные решения"                 |
| `department_code` | text NULL              | Код отдела: КР, ОВ, ЭС, АР, ТМ...                                    |
| `team`            | text NULL              | Команда внутри отдела                                                |
| `user_id`         | uuid NULL → auth.users | Заполняется при OAuth-входе                                          |
| `is_admin`        | boolean DEFAULT false  | Флаг администратора. Попадает в JWT через `custom_access_token_hook` |
| `is_active`       | boolean                | Деактивация при отсутствии в WS API                                  |
| `synced_at`       | timestamptz            |                                                                      |

**Частота обновления:** ежедневно (VPS-оркестратор). Обновляет существующие записи, деактивирует удалённых, реактивирует вернувшихся. Никогда не удаляет строки — только `is_active = false`. Поля `user_id`, `department_code` и `is_admin` не трогаются синком.

#### `profiles` (2 строки)

Профили зарегистрированных пользователей. Создаётся при первом OAuth-входе.

| Колонка      | Тип                  | Описание |
| ------------ | -------------------- | -------- |
| `user_id`    | uuid PK → auth.users |          |
| `first_name` | text                 |          |
| `last_name`  | text                 |          |
| `email`      | text UNIQUE          |          |
| `team`       | text NULL            |          |
| `department` | text NULL            |          |
| `created_at` | timestamptz          |          |
| `updated_at` | timestamptz          |          |

**Частота обновления:** при каждом входе пользователя. Триггер `trg_link_ws_user_on_profile_insert` при создании профиля автоматически проставляет `ws_users.user_id`.

#### `worksection_tokens` (2 строки)

OAuth-токены Worksection для пользователей.

| Колонка         | Тип                  | Описание                 |
| --------------- | -------------------- | ------------------------ |
| `user_id`       | uuid PK → auth.users |                          |
| `access_token`  | text                 |                          |
| `refresh_token` | text                 |                          |
| `account_url`   | text                 | URL аккаунта Worksection |
| `expires_at`    | timestamptz          | Срок действия токена     |
| `updated_at`    | timestamptz          |                          |

**Частота обновления:** при OAuth-авторизации. Токены имеют срок действия и могут быть просрочены.

---

### Группа B: Данные из Worksection

Синкаются VPS-скриптами из Worksection API. Все таблицы — **upsert** при синке (старые данные обновляются, не стираются).

#### `ws_projects` (69 строк)

Активные проекты с тегом "eneca.work sync".

| Колонка         | Тип         | Описание                 |
| --------------- | ----------- | ------------------------ |
| `id`            | uuid PK     |                          |
| `ws_project_id` | text UNIQUE | ID проекта в Worksection |
| `name`          | text        |                          |
| `status`        | text        | `active` / `archived`    |
| `tag`           | text NULL   | Тег проекта              |
| `synced_at`     | timestamptz |                          |

**Частота обновления:** ежедневно. Скрипт `sync-ws-projects` добавляет новые, обновляет имена, архивирует удалённые. Строки не удаляются.

#### `ws_tasks_l2` (4517 строк)

Задачи 2-го уровня (разделы внутри проекта).

| Колонка          | Тип                  | Описание              |
| ---------------- | -------------------- | --------------------- |
| `id`             | uuid PK              |                       |
| `ws_task_id`     | text UNIQUE          |                       |
| `ws_project_id`  | text                 |                       |
| `parent_l1_id`   | text NULL            | ID задачи L1 (группа) |
| `parent_l1_name` | text NULL            | Название группы       |
| `name`           | text                 |                       |
| `assignee_id`    | uuid NULL → ws_users |                       |
| `assignee_email` | text NULL            |                       |
| `max_time`       | numeric NULL         | Бюджет часов          |
| `date_closed`    | timestamptz NULL     |                       |
| `synced_at`      | timestamptz          |                       |

**Частота обновления:** ежедневно. Скрипт `sync-ws-tasks` парсит дерево задач из всех проектов. Upsert по `ws_task_id`.

#### `ws_tasks_l3` (11 083 строки)

Задачи 3-го уровня (конкретные работы внутри разделов).

| Колонка          | Тип                           | Описание                                                                                                       |
| ---------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `id`             | uuid PK                       |                                                                                                                |
| `ws_task_id`     | text UNIQUE                   |                                                                                                                |
| `ws_project_id`  | text                          |                                                                                                                |
| `parent_l2_id`   | text → ws_tasks_l2.ws_task_id |                                                                                                                |
| `name`           | text                          |                                                                                                                |
| `assignee_id`    | uuid NULL → ws_users          |                                                                                                                |
| `assignee_email` | text NULL                     |                                                                                                                |
| `percent`        | smallint NULL                 | Процент выполнения (0-100)                                                                                     |
| `max_time`       | numeric NULL                  | Бюджет часов                                                                                                   |
| `custom_status`  | text NULL                     | Кастомный статус из тегов «Система планирования» (В работе, План, Пауза, Приостановлено, Согласование, Готово) |
| `date_end`       | date NULL                     | Плановая дата завершения из WS API                                                                             |
| `date_closed`    | timestamptz NULL              |                                                                                                                |
| `synced_at`      | timestamptz                   |                                                                                                                |

**Частота обновления:** ежедневно. Upsert по `ws_task_id`. Процент парсится из тегов задач.

#### `ws_task_actual_hours` (5604 строки)

Фактические трудозатраты по задачам L3.

| Колонка       | Тип                       | Описание       |
| ------------- | ------------------------- | -------------- |
| `id`          | uuid PK                   |                |
| `ws_task_id`  | text UNIQUE → ws_tasks_l3 |                |
| `total_hours` | numeric                   | Суммарные часы |
| `synced_at`   | timestamptz               |                |

**Частота обновления:** ежедневно. Скрипт `sync-ws-costs` суммирует таймтрекинг. Upsert — перезаписывает total_hours.

#### `ws_task_actual_hours_l2` (0 строк)

Фактические трудозатраты по задачам L2. Структура идентична `ws_task_actual_hours`, FK → `ws_tasks_l2`.

**Частота обновления:** ежедневно. Пока пустая — заполняется `sync-ws-costs`.

#### `ws_daily_reports` (173 строки)

Ежедневные отчёты о трудозатратах по сотрудникам.

| Колонка       | Тип                  | Описание               |
| ------------- | -------------------- | ---------------------- |
| `id`          | uuid PK              |                        |
| `user_id`     | uuid NULL → ws_users |                        |
| `user_email`  | text                 |                        |
| `report_date` | date                 |                        |
| `total_hours` | numeric              | Суммарные часы за день |
| `synced_at`   | timestamptz          |                        |

**Частота обновления:** ежедневно. Скрипт `sync-ws-costs` агрегирует часы по сотрудникам за каждый рабочий день. Upsert по (user_email, report_date). Наличие записи = сотрудник вёл таймтрекинг в этот день (зелёный день WS).

#### `ws_task_percent_snapshots` (11 083 строки)

Ежедневные снапшоты процента выполнения задач L3.

| Колонка         | Тип                | Описание |
| --------------- | ------------------ | -------- |
| `id`            | uuid PK            |          |
| `ws_task_id`    | text → ws_tasks_l3 |          |
| `percent`       | smallint NULL      |          |
| `snapshot_date` | date               |          |

**Частота обновления:** ежедневно. Скрипт `snapshot-task-percent` копирует текущий `percent` из `ws_tasks_l3`. UNIQUE по (ws_task_id, snapshot_date). Используется для определения task dynamics violations (бюджет расходуется, но процент не меняется).

#### `ws_task_budget_checkpoints` (0 строк)

Чекпоинты бюджета задач L3 (20%/40%/60%/80%/100%).

| Колонка                 | Тип                       | Описание                                          |
| ----------------------- | ------------------------- | ------------------------------------------------- |
| `id`                    | uuid PK                   |                                                   |
| `ws_task_id`            | text UNIQUE → ws_tasks_l3 |                                                   |
| `last_checkpoint`       | smallint DEFAULT 0        | Последний пройденный чекпоинт (0/20/40/60/80/100) |
| `percent_at_checkpoint` | smallint NULL             | Процент задачи на момент чекпоинта                |
| `updated_at`            | timestamptz               |                                                   |

**Частота обновления:** по мере прохождения чекпоинтов в `compute-gamification`. Пока пустая.

#### `ws_user_absences` (32 строки)

Дни отсутствия сотрудников.

| Колонка        | Тип                  | Описание                               |
| -------------- | -------------------- | -------------------------------------- |
| `id`           | uuid PK              |                                        |
| `user_id`      | uuid NULL → ws_users |                                        |
| `user_email`   | text                 |                                        |
| `absence_type` | text CHECK           | `vacation` / `sick_leave` / `sick_day` |
| `absence_date` | date                 |                                        |
| `synced_at`    | timestamptz          |                                        |

**Частота обновления:** ежедневно. Скрипт `sync-ws-absences` синкает из двух источников: расписание отпусков/больничных (WS API `get_users_schedule`) и задача "Сикдеи" (task ID 4905680). Upsert по (user_email, absence_date). Используется для заморозки стриков и пропуска нарушений.

#### `ws_task_status_changes`

История смен статусов планирования из WS API get_events. Синкается скриптом `sync-task-events` (period=1d1h). Используется `compute-gamification` для определения, была ли задача «В работе» в течение дня.

| Колонка            | Тип                  | Описание |
| ------------------ | -------------------- | -------- |
| `id`               | uuid PK              |          |
| `ws_task_id`       | text NOT NULL        |          |
| `old_status`       | text NULL            |          |
| `new_status`       | text NULL            |          |
| `changed_at`       | timestamptz NOT NULL |          |
| `changed_by_email` | text NULL            |          |
| `event_date`       | date NOT NULL        |          |
| `synced_at`        | timestamptz          |          |

UNIQUE по `(ws_task_id, changed_at)` — защита от дублей при повторном запуске.

**Частота обновления:** ежедневно. Скрипт `sync-task-events` парсит теги «Система планирования» из WS API `get_events`. Upsert с `ignoreDuplicates` — повторный запуск безопасен.

#### `ws_daily_report_tasks`

Детализированные записи трудозатрат по задачам за день. Синкается скриптом `sync-ws-costs` вместе с `ws_daily_reports`. Используется `compute-gamification` (шаг 1d) для проверки неверного статуса.

| Колонка      | Тип                  | Описание |
| ------------ | -------------------- | -------- |
| `id`         | uuid PK              |          |
| `user_email` | text NOT NULL        |          |
| `user_id`    | uuid NULL → ws_users |          |
| `ws_task_id` | text NOT NULL        |          |
| `cost_date`  | date NOT NULL        |          |
| `hours`      | numeric NOT NULL     |          |
| `synced_at`  | timestamptz          |          |

UNIQUE(user_email, ws_task_id, cost_date).

**Частота обновления:** ежедневно. Скрипт `sync-ws-costs` синкает вместе с `ws_daily_reports`. Upsert по (user_email, ws_task_id, cost_date).

---

### Группа B2: Производственный календарь

#### `calendar_holidays` (0 строк)

Праздники и нерабочие дни. Управляется админами (`ws_users.is_admin`).

| Колонка      | Тип                    | Описание                              |
| ------------ | ---------------------- | ------------------------------------- |
| `id`         | bigint PK (identity)   |                                       |
| `date`       | date UNIQUE            | Дата праздника                        |
| `name`       | text                   | Название ("День Победы", "Новый год") |
| `created_by` | uuid NULL → auth.users | Кто добавил                           |
| `created_at` | timestamptz            |                                       |

**Эффект:** VPS-скрипт `compute-gamification` пропускает этот день (не обрабатывает). Фронтенд показывает как серый (выходной).

**RLS:** чтение — все authenticated, управление — только админы.

#### `calendar_workdays` (0 строк)

Рабочие переносы (когда выходной становится рабочим). Управляется админами.

| Колонка      | Тип                    | Описание                            |
| ------------ | ---------------------- | ----------------------------------- |
| `id`         | bigint PK (identity)   |                                     |
| `date`       | date UNIQUE            | Дата переноса (суббота/воскресенье) |
| `name`       | text                   | Причина ("Перенос с 31 декабря")    |
| `created_by` | uuid NULL → auth.users | Кто добавил                         |
| `created_at` | timestamptz            |                                     |

**Эффект:** VPS-скрипт обрабатывает этот день как рабочий (несмотря на Сб/Вс). Фронтенд показывает как рабочий день (не серый).

**RLS:** чтение — все authenticated, управление — только админы.

---

### Группа C: Source-таблицы из внешних систем

#### `elk_plugin_launches` (4103 строки)

Запуски Revit-плагинов. Синкается из Elasticsearch/Kibana. Одна строка на (user_email, work_date, plugin_name).

| Колонка        | Тип               | Описание                                                     |
| -------------- | ----------------- | ------------------------------------------------------------ |
| `id`           | uuid PK           |                                                              |
| `user_email`   | text              | Нижний регистр                                               |
| `work_date`    | date              | Всегда вчерашний день при вставке синком                     |
| `plugin_name`  | text              | Название плагина (ShareModel, LookupTables, LinksManager...) |
| `launch_count` | integer CHECK > 0 | Количество запусков за день                                  |
| `synced_at`    | timestamptz       |                                                              |

**Частота обновления:** ежедневно в 01:00 UTC (pg_cron → edge function `sync-plugin-launches`). Одна строка = один пользователь + один плагин + один день. Upsert по (user_email, work_date, plugin_name). Старые данные не стираются.

**Триггер:** `trg_award_revit_points` → `fn_award_revit_points()` — начисляет `revit_using_plugins` (+5), обновляет `revit_user_streaks`, бонус при 7/30.

#### `at_gratitudes` (16 строк)

Благодарности из Airtable.

| Колонка               | Тип         | Описание                                    |
| --------------------- | ----------- | ------------------------------------------- |
| `id`                  | text PK     | Airtable record ID                          |
| `sender_email`        | text NULL   |                                             |
| `recipient_email`     | text NULL   |                                             |
| `recipient_name`      | text        |                                             |
| `message`             | text        | Текст благодарности                         |
| `airtable_created_at` | timestamptz |                                             |
| `week_start`          | date        | Понедельник недели (для лимита отправителя) |
| `airtable_status`     | text NULL   |                                             |
| `deleted_in_airtable` | boolean     | Soft-delete                                 |
| `synced_at`           | timestamptz |                                             |

**Частота обновления:** каждые 4 часа (pg_cron → edge function `sync-gratitudes`). Синкает только текущий месяц. Upsert по Airtable ID. Удалённые записи помечаются `deleted_in_airtable = true`, не удаляются физически.

**Триггер:** `trg_award_gratitude_points` → `fn_award_gratitude_points()` — начисляет `gratitude_recipient_points` (+20) получателю. Лимит: 1 начисление от одного отправителя за `week_start`. Срабатывает на INSERT и на UPDATE (только при изменении `deleted_in_airtable` или `airtable_status`).

---

### Группа D: Ядро геймификации

Единая система начисления 💎. Данные пишутся двумя путями: PG-триггерами (Revit, благодарности) и VPS-скриптом `compute-gamification` (WS-события).

#### `gamification_event_types`

Справочник типов событий и их стоимость в 💎. Колонка `name` — человекочитаемое название для отображения в UI. Редактируется админами через `/admin/events`.

**С начислением/списанием 💎:**

| key                          | coins | description                                              |
| ---------------------------- | ----- | -------------------------------------------------------- |
| `master_planner`             | +450  | Мастер планирования: 10 задач L3 подряд в бюджете        |
| `ws_streak_90`               | +300  | Бонус за стрик 90 зелёных дней (WS)                      |
| `budget_ok_l2`               | +200  | Раздел L2 закрыт в рамках бюджета (30 дней)              |
| `team_contest_top1_bonus`    | +200  | Бонус каждому сотруднику отдела-победителя               |
| `revit_streak_30_bonus`      | +100  | Бонус за стрик 30 дней (Revit)                           |
| `ws_streak_30`               | +100  | Бонус за стрик 30 зелёных дней (WS)                      |
| `budget_ok_l3`               | +50   | Задача L3 закрыта в рамках бюджета (30 дней)             |
| `revit_streak_7_bonus`       | +25   | Бонус за стрик 7 дней (Revit)                            |
| `ws_streak_7`                | +25   | Бонус за стрик 7 зелёных дней (WS)                       |
| `gratitude_recipient_points` | +20   | 💎 получателю благодарности                              |
| `revit_using_plugins`        | +5    | 💎 за использование плагина                              |
| `budget_ok_l3_lead_bonus`    | +5    | Бонус тимлиду L2 за закрытие дочерней L3 в бюджете       |
| `green_day`                  | +3    | Зелёный день (все проверки пройдены)                     |
| `budget_revoked_l3_lead`     | -5    | Отзыв бонуса тимлиду: бюджет L3 превышен                 |
| `budget_revoked_l3`          | -50   | Отзыв 💎: бюджет L3 превышен после approval              |
| `budget_revoked_l2`          | -200  | Отзыв 💎: бюджет L2 превышен после approval              |
| `wrong_status_report`        | -3    | Время внесено в задачу L3 не в статусе «В работе»        |
| `deadline_ok_l3`             | +3    | Задача закрыта до плановой даты (проверка через 30 дней) |
| `deadline_revoked_l3`        | -3    | Бонус за срок отозван: задача переоткрыта после approval |

**Информационные (0 💎, фиксируют факт события):**

| key                         | description                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| `red_day`                   | Красный день (есть нарушения)                                                               |
| `task_dynamics_violation`   | Нарушение динамики: метка % не обновлена                                                    |
| `section_red`               | Дисциплина раздела: нарушение у исполнителя L3                                              |
| `budget_exceeded_l3`        | Бюджет L3 превышен при проверке                                                             |
| `budget_exceeded_l2`        | Бюджет L2 превышен при проверке                                                             |
| `streak_reset_timetracking` | Стрик сброшен: не внёс время                                                                |
| `streak_reset_dynamics`     | Стрик сброшен: нарушение динамики задачи                                                    |
| `streak_reset_section`      | Стрик сброшен: нарушение в разделе                                                          |
| `master_planner_reset`      | Серия мастера планирования сброшена                                                         |
| `balance_correction`        | Разовая техническая коррекция баланса (миграция 028, clamp отрицательных к 0). `is_active = false` |

**Частота обновления:** вручную администратором. Таблица-справочник.

#### `gamification_event_logs` (2890 строк)

Журнал всех событий геймификации.

| Колонка           | Тип                                 | Описание                                            |
| ----------------- | ----------------------------------- | --------------------------------------------------- |
| `id`              | uuid PK                             |                                                     |
| `user_id`         | uuid → ws_users                     |                                                     |
| `user_email`      | text                                | Денормализовано для удобства                        |
| `event_type`      | text → gamification_event_types.key |                                                     |
| `source`          | text                                | Источник: `revit`, `airtable`, `ws`, `shop`         |
| `event_date`      | date                                | Дата события                                        |
| `details`         | jsonb NULL                          | Детали (plugin_name, launch_count, gratitude_id...) |
| `idempotency_key` | text UNIQUE NULL                    | Защита от дублей                                    |
| `created_at`      | timestamptz                         |                                                     |

**Формат `details` по source:**

| source     | Поля details                                       |
| ---------- | -------------------------------------------------- |
| `revit`    | `plugin_name`, `launch_count`                      |
| `airtable` | `gratitude_id`, `sender_email`                     |
| `ws`       | `ws_task_id`, `ws_task_name`, `ws_project_id`, ... |

**Частота обновления:** при каждом синке. Append-only — строки не удаляются и не обновляются. Idempotency key гарантирует отсутствие дублей.

#### `gamification_transactions` (2890 строк)

Финансовый журнал начислений/списаний 💎.

| Колонка      | Тип                                   | Описание                                             |
| ------------ | ------------------------------------- | ---------------------------------------------------- |
| `id`         | uuid PK                               |                                                      |
| `user_id`    | uuid → ws_users                       |                                                      |
| `user_email` | text                                  |                                                      |
| `event_id`   | uuid UNIQUE → gamification_event_logs | 1:1 связь с событием                                 |
| `coins`      | integer                               | Положительный = начисление, отрицательный = списание |
| `created_at` | timestamptz                           |                                                      |

**Частота обновления:** при каждом синке вместе с `gamification_event_logs`. Append-only. Одна транзакция = одно событие (UNIQUE на `event_id`).

#### `gamification_balances` (271 строка)

Текущий баланс 💎 каждого сотрудника.

| Колонка       | Тип                | Описание |
| ------------- | ------------------ | -------- |
| `user_id`     | uuid PK → ws_users |          |
| `total_coins` | integer DEFAULT 0  |          |
| `updated_at`  | timestamptz        |          |

**Частота обновления:** атомарно при каждом начислении через inline UPSERT в триггерах. Upsert — создаётся при первом начислении, далее инкрементируется.

Баланс не уходит ниже 0. `process_gamification_event` при отрицательном `p_coins` ограничивает списание доступным балансом и пишет в `gamification_transactions` фактическую сумму — инвариант `SUM(transactions) = balance` сохраняется. Остаток «долга» теряется (см. event_type `balance_correction` для исторических данных).

Если баланс рассинхронизировался — пересчитать:

```sql
UPDATE gamification_balances b
SET total_coins = COALESCE((SELECT SUM(coins) FROM gamification_transactions t WHERE t.user_id = b.user_id), 0),
    updated_at = now();
```

После запуска `process_gamification_event` clamp'ит штрафы по факту, поэтому `SUM(transactions)` уже не может быть отрицательной для новых транзакций.

#### `revit_user_streaks` (267 строк)

Стрики по использованию Revit-плагинов. Обновляется триггером `fn_award_revit_points()` мгновенно.

| Колонка           | Тип                                  | Описание                        |
| ----------------- | ------------------------------------ | ------------------------------- |
| `user_id`         | uuid PK → ws_users ON DELETE CASCADE |                                 |
| `current_streak`  | integer DEFAULT 0                    | Текущая серия зелёных дней      |
| `best_streak`     | integer DEFAULT 0                    | Максимальная серия за всё время |
| `last_green_date` | date NULL                            | Дата последнего зелёного дня    |
| `is_frozen`       | boolean DEFAULT false                | Заморозка (отпуск/больничный)   |
| `freeze_reason`   | text NULL                            |                                 |
| `frozen_at`       | timestamptz NULL                     |                                 |
| `updated_at`      | timestamptz                          |                                 |

**Частота обновления:** при каждом синке `elk_plugin_launches` через триггер. Непрерывность стрика проверяется с учётом выходных и отсутствий: считаются рабочие дни-пропуски между `last_green_date` и `work_date` через `generate_series`, пропуская Сб/Вс (`dow IN (0,6)`) и записи из `ws_user_absences`. Если пропусков нет → `current_streak + 1`; если есть → `current_streak = 1`. При milestone (7/30) создаётся бонусное событие.

#### `ws_user_streaks` (558 строк)

Стрики по таймтрекингу в Worksection.

| Колонка             | Тип                | Описание                                                       |
| ------------------- | ------------------ | -------------------------------------------------------------- |
| `user_id`           | uuid PK → ws_users |                                                                |
| `current_streak`    | integer DEFAULT 0  | Календарных дней от streak_start_date                          |
| `longest_streak`    | integer DEFAULT 0  |                                                                |
| `streak_start_date` | date NULL          | Дата первого зелёного дня текущего стрика. NULL при стрике = 0 |
| `completed_cycles`  | integer DEFAULT 0  | Счётчик завершённых 90-дневных стриков                         |
| `updated_at`        | timestamptz        |                                                                |

**Частота обновления:** обновляется `compute-gamification` (VPS). При зелёном дне — `current_streak = diffCalendarDays(streak_start_date, date) + 1`. При красном — сброс в 0. При отсутствии — заморозка (ничего не меняется).

#### `budget_pending` (0 строк)

Очередь отложенных выплат за соблюдение бюджета задач (проверка через 30 дней после закрытия).

| Колонка          | Тип                     | Описание                                          |
| ---------------- | ----------------------- | ------------------------------------------------- |
| `id`             | uuid PK                 |                                                   |
| `ws_task_l2_id`  | text NULL → ws_tasks_l2 |                                                   |
| `ws_task_l3_id`  | text NULL → ws_tasks_l3 |                                                   |
| `assignee_id`    | uuid → ws_users         |                                                   |
| `assignee_email` | text                    |                                                   |
| `closed_at`      | timestamptz             | Дата закрытия задачи                              |
| `eligible_date`  | date                    | Дата, когда можно проверить (closed_at + 30 дней) |
| `status`         | text CHECK              | `pending` / `approved` / `revoked`                |
| `checked_at`     | timestamptz NULL        |                                                   |

**Частота обновления:** заполняется `compute-gamification` при закрытии задач. Проверяется ежедневно — если `eligible_date` наступила и задача всё ещё в бюджете → `approved` и начисление. Пока пустая.

#### `deadline_pending` (0 строк)

Очередь отложенных проверок сроков задач L3 (аналогично `budget_pending`). Создаётся при закрытии задачи L3 с `date_end`. Проверяется через 30 дней.

| Колонка          | Тип                           | Описание                                          |
| ---------------- | ----------------------------- | ------------------------------------------------- |
| `id`             | uuid PK                       |                                                   |
| `ws_task_l3_id`  | text → ws_tasks_l3.ws_task_id |                                                   |
| `assignee_id`    | uuid NOT NULL → ws_users      |                                                   |
| `assignee_email` | text NOT NULL                 |                                                   |
| `closed_at`      | timestamptz NOT NULL          | Дата закрытия задачи                              |
| `planned_end`    | date NOT NULL                 | Плановая дата завершения                          |
| `eligible_date`  | date NOT NULL                 | Дата, когда можно проверить (closed_at + 30 дней) |
| `status`         | text CHECK                    | `pending` / `approved` / `revoked`                |
| `checked_at`     | timestamptz NULL              |                                                   |

**Частота обновления:** заполняется `compute-gamification` при закрытии задач L3 с `date_end`. Проверяется ежедневно — если `eligible_date` наступила и задача закрыта до `planned_end` → `approved` и начисление `deadline_ok_l3`. Если задача переоткрыта после approval → `revoked` и списание `deadline_revoked_l3`. Пока пустая.

---

### Views

#### `ws_daily_statuses` (таблица)

Статус дня сотрудника: `green` / `red` / `absent`. Заполняется VPS-скриптом `compute-gamification` (upsert по user_id + date). PK: `(user_id, date)`. Колонки: `status`, `absence_type`, `red_reasons` (jsonb). Нет записи = скрипт ещё не обработал день.

`red_reasons` — массив объектов с причинами красного дня. Каждый объект содержит `type` и опциональные поля задачи:

- `{ type: 'red_day' }` — не внесён отчёт
- `{ type: 'task_dynamics_violation', ws_task_id, ws_task_name, ws_project_id, ws_l2_id }` — не сменён процент готовности
- `{ type: 'section_red', ws_task_id, ws_task_name, ws_project_id, ws_l2_id }` — нарушение в подчинённой задаче (для ТЛ)

#### `view_daily_statuses` (deprecated)

Устаревший view. Заменён таблицей `ws_daily_statuses`. Оставлен для обратной совместимости, будет удалён.

#### `view_user_transactions`

JOIN `gamification_transactions` + `gamification_event_logs` + `gamification_event_types` — полная история транзакций с описаниями.

#### `view_budget_pending_status`

Статус отложенных бюджетных выплат с данными задач, проектов и оставшимися днями до проверки.

#### `v_gratitudes_feed`

Лента благодарностей: JOIN `at_gratitudes` + `ws_users` (имя отправителя) + `gamification_event_logs/transactions` (начисленные 💎). Исключает `deleted_in_airtable = true`.

#### `view_department_revit_contest`

Сумма ревит-💎 по отделам за текущий месяц. Используется в `getDepartmentAutomationStats()` для рейтинга соревнования. Колонки: `department_code`, `users_earning`, `total_employees`, `total_coins`. Отделы без 💎 показываются с `total_coins = 0`.

---

## Триггеры

| Триггер                              | Таблица               | Функция                            | Что делает                                                                          |
| ------------------------------------ | --------------------- | ---------------------------------- | ----------------------------------------------------------------------------------- |
| `trg_award_revit_points`             | `elk_plugin_launches` | `fn_award_revit_points()`          | +5 за плагин, inline UPSERT баланса, обновляет `revit_user_streaks`, бонус при 7/30 |
| `trg_award_gratitude_points`         | `at_gratitudes`       | `fn_award_gratitude_points()`      | +20 получателю благодарности, лимит 1/отправитель/неделю, inline UPSERT баланса     |
| `trg_link_ws_user_on_profile_insert` | `profiles`            | `link_ws_user_on_profile_insert()` | При создании профиля связывает `ws_users.user_id`                                   |

Идемпотентность: триггеры используют `idempotency_key` с `ON CONFLICT DO NOTHING`.

Процесс записи в триггерах (атомарно):

1. `INSERT gamification_event_logs` с `idempotency_key` → ON CONFLICT DO NOTHING
2. `INSERT gamification_transactions` (event_id, coins)
3. `UPSERT gamification_balances` (total_coins += coins) — inline, без вызова `increment_balance()`

---

## Edge Functions (Supabase)

WS-функции удалены — их полностью заменили VPS-скрипты. `sync-plugin` — legacy-версия `sync-plugin-launches` (не используется, подлежит удалению).

| Функция                | Что делает                                    | Расписание             |
| ---------------------- | --------------------------------------------- | ---------------------- |
| `sync-plugin-launches` | Синк запусков Revit-плагинов из Elasticsearch | pg_cron: `0 1 * * *`   |
| `sync-gratitudes`      | Синк благодарностей из Airtable               | pg_cron: `0 */4 * * *` |
| `sync-plugin`          | Legacy. Не используется                       | —                      |

---

## VPS-скрипты (eneca-dev/gamification-vps-scripts)

Репозиторий: **eneca-dev/gamification-vps-scripts**, директория `src/`.

### Оркестратор (`orchestrator.ts`)

Запускает 8 скриптов последовательно, собирает статистику, отправляет уведомление в Telegram.

### Скрипты (`scripts/`)

| Скрипт                     | Целевые таблицы                                                                                                                                                                                                      | Что делает                                                                                                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sync-ws-users.ts`         | `ws_users`                                                                                                                                                                                                           | Синк сотрудников из WS API. Insert/update/deactivate/reactivate                                                                                                                 |
| `sync-ws-projects.ts`      | `ws_projects`                                                                                                                                                                                                        | Синк проектов с тегом "eneca.work sync". Insert/update/archive                                                                                                                  |
| `sync-ws-tasks.ts`         | `ws_tasks_l2`, `ws_tasks_l3`                                                                                                                                                                                         | Парсинг дерева задач L1→L2→L3 из всех проектов                                                                                                                                  |
| `sync-ws-costs.ts`         | `ws_daily_reports`, `ws_daily_report_tasks`, `ws_task_actual_hours`, `ws_task_actual_hours_l2`                                                                                                                       | Синк таймтрекинга: дневные отчёты + детализация по задачам + фактические часы                                                                                                   |
| `snapshot-task-percent.ts` | `ws_task_percent_snapshots`                                                                                                                                                                                          | Снапшот текущего % задач L3                                                                                                                                                     |
| `sync-ws-absences.ts`      | `ws_user_absences`                                                                                                                                                                                                   | Синк отсутствий из расписания + задачи сикдеев                                                                                                                                  |
| `sync-task-events.ts`      | `ws_task_status_changes`                                                                                                                                                                                             | Синк смен статусов из WS API get_events (period=1d1h). Парсит теги «Система планирования»                                                                                       |
| `compute-gamification.ts`  | `gamification_event_logs`, `gamification_transactions`, `gamification_balances`, `ws_user_streaks`, `ws_daily_statuses`, `budget_pending`, `deadline_pending`, `ws_task_budget_checkpoints`, `ws_daily_report_tasks` | Основной движок WS-геймификации: нарушения, статусы дней, стрики, бюджеты, дедлайны, транзакции. Пропускает Сб/Вс (кроме `calendar_workdays`) и праздники (`calendar_holidays`) |

### Библиотеки (`lib/`)

| Файл          | Назначение                                                                          |
| ------------- | ----------------------------------------------------------------------------------- |
| `env.ts`      | Переменные окружения (SUPABASE_URL, SUPABASE_SECRET_KEY, WORKSECTION_ADMIN_API_KEY) |
| `logger.ts`   | Логгер с таймстампами и префиксом скрипта                                           |
| `supabase.ts` | Клиент Supabase (service_role)                                                      |
| `telegram.ts` | Уведомления в Telegram (сплит сообщений > 4096 символов)                            |
| `types.ts`    | Типы: WsUser, WsProject, WsTaskRaw, WsCostEntry, DbUser, DbProject, ScriptResult    |
| `ws-api.ts`   | WorkSection API: аутентификация (MD5), конвертация дат, парсинг времени             |

### Health-check (`health.ts`)

Express-сервер на порту 3000, endpoint `GET /health` → "Working 2.0".

---

## Ограничения

- `gamification_transactions` — append-only, строки не удаляются и не обновляются
- Email в `ws_users` — всегда нижний регистр (CHECK constraint). Source-таблицы хранят email как есть — сравнение в триггерах через `lower()`
- Баланс не уходит ниже 0. Штраф через `process_gamification_event` списывается в пределах доступного (clamp) — в `gamification_transactions` пишется фактическая сумма. Покупки и подарки за свой счёт отдельно проверяют баланс и отклоняются при нехватке. Разовая коррекция существующих минусов выполнена миграцией 028 (event_type `balance_correction`)
- WS-скрипты запускаются VPS-оркестратором, не pg_cron — из-за ограничений Edge Functions на время выполнения
- `ws_users` — строки не удаляются физически, только деактивация
- Все source-таблицы работают через upsert — данные обновляются, не стираются
- `ws_task_percent_snapshots` — append-only (UNIQUE по ws_task_id + snapshot_date), не обновляет существующие
