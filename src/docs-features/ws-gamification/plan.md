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

### 4b. ✅ `ws_task_actual_hours` — фактические часы по задаче (синк 1 раз/день)

| Колонка     | Тип                       | Описание                                             |
| ----------- | ------------------------- | ---------------------------------------------------- |
| id          | uuid PK                   |                                                      |
| ws_task_id  | text UNIQUE NOT NULL      | FK → ws_tasks_l3.ws_task_id                          |
| total_hours | numeric NOT NULL          | Суммарные часы по задаче (все пользователи, все дни) |
| synced_at   | timestamptz DEFAULT now() |                                                      |

Источник: `get_costs` без datestart/dateend (всё время) → агрегация по task_id.
Полностью перезаписывается при каждом синке — всегда актуальные данные, включая отчёты задним числом.

Используется для:

- Правило 2: `budget_percent = (total_hours / max_time) * 100` → пересечена ли контрольная точка
- Правило 4: `total_hours <= max_time` → задача закрыта в рамках бюджета?

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

### 8. `view_daily_statuses` — VIEW: зелёный / красный / отсутствует по дням

Не таблица, а view. Вычисляется из `gamification_events` и `ws_user_absences`:

- absent: есть строка в `ws_user_absences` на эту дату
- red: есть хотя бы одно событие с негативным типом (red_day, task_dynamics_violation и т.д.)
- green: нет absent и нет red-событий

Причины красного дня подтягиваются из событий (array_agg).

### 9. `gamification_events` — универсальный лог событий (вычисляется)

| Колонка        | Тип                       | Описание                                   |
| -------------- | ------------------------- | ------------------------------------------ |
| id             | uuid PK                   |                                            |
| user_id        | uuid NOT NULL             | FK → ws_users.id                           |
| user_email     | text NOT NULL             | На кого влияет событие                     |
| event_type     | text NOT NULL             | FK → gamification_event_types.key          |
| ref_task_id    | text NULL                 | ws_task_id, если событие связано с задачей |
| ref_project_id | text NULL                 | ws_project_id, если релевантно             |
| event_date     | date NOT NULL             | Когда произошло событие                    |
| details        | jsonb NULL                | Доп. контекст                              |
| created_at     | timestamptz DEFAULT now() |                                            |

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

### 11. `gamification_transactions` — история начислений/списаний баллов

| Колонка    | Тип                       | Описание                                   |
| ---------- | ------------------------- | ------------------------------------------ |
| id         | uuid PK                   |                                            |
| user_id    | uuid NOT NULL             | FK → ws_users.id                           |
| user_email | text NOT NULL             | На кого начислено/списано                  |
| event_id   | uuid NOT NULL             | FK → gamification_events.id                |
| points     | integer NOT NULL          | Количество баллов (+ или −)                |
| created_at | timestamptz DEFAULT now() |                                            |

Каждая транзакция привязана к конкретному событию. Баланс пользователя = SUM(points) из транзакций. Стоимость берётся из `gamification_event_types` на момент создания транзакции.

### 12. `budget_pending` — задачи, ожидающие 30-дневной проверки бюджета

| Колонка        | Тип                             | Описание                           |
| -------------- | ------------------------------- | ---------------------------------- |
| id             | uuid PK                         |                                    |
| ws_task_id     | text UNIQUE NOT NULL            |                                    |
| level          | text NOT NULL                   | 'L2' / 'L3'                        |
| assignee_id    | uuid NOT NULL                   | FK → ws_users.id                   |
| assignee_email | text NOT NULL                   | Ответственный на момент закрытия   |
| closed_at      | timestamptz NOT NULL            | Когда задача была закрыта          |
| eligible_date  | date NOT NULL                   | closed_at + 30 дней                |
| status         | text NOT NULL DEFAULT 'pending' | 'pending' / 'approved' / 'revoked' |
| checked_at     | timestamptz NULL                | Когда была выполнена проверка      |

Процесс:

1. Задача закрывается → вставляем строку с status='pending', eligible_date = closed_at + 30 дней
2. Задача переоткрывается до eligible_date → удаляем строку (событие не создаётся)
3. Наступает eligible_date → считаем бюджет: SUM(hours) из ws_task_actual_hours <= max_time?
   - Да → status='approved', создаём событие budget_ok
   - Нет → status='revoked', создаём событие budget_exceeded
4. Задача переоткрывается ПОСЛЕ approved → перепроверяем при следующем закрытии
5. Проект в архиве → игнорируем все pending-строки этого проекта

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

Последовательность:

1. **Дневные статусы (правило 1)**: за вчера для каждого активного пользователя — проверяем `ws_daily_reports` и `ws_user_absences` → создаём событие `green_day` или `red_day` в `gamification_events`. Дневной статус вычисляется через `view_daily_statuses` (view)
2. **Отслеживание стриков (правило 5)**: обновляем `ws_user_streaks` (green → +1, red → 0, absent → skip), проверяем вехи (7/30/90), создаём события ws_streak_7/30/90
3. **Динамика задач (правило 2)**: для каждой активной L3 считаем % съеденного бюджета. Если пересечена контрольная точка (20/40/60/80/100%) и метка % не менялась с прошлой точки → создаём нарушение, обнуляем стрик ответственного
4. **Дисциплина разделов (правило 3)**: для каждого L2 проверяем, было ли у любого ответственного за L3 нарушение сегодня → если да, создаём section_red, обнуляем стрик тимлида
5. **Проверки бюджета (правило 4)**:
   - Новые закрытия: insert в `budget_pending`
   - Переоткрытые: обрабатываем pending/approved строки
   - Подошёл срок: проверяем бюджет, создаём события
   - Архивные проекты: пропускаем
6. **Мастер планирования (правило 5)**: по каждому пользователю считаем последовательные budget_ok_l3 события
7. **Транзакции**: для каждого нового события в `gamification_events` → берём стоимость из `gamification_event_types` → insert в `gamification_transactions`

---

## Детали правил

### Правило 1: Ежедневный отчёт (Тайм-трекинг)

```
для каждого активного ws_user (не отсутствует на дату):
  has_entries = EXISTS(ws_daily_reports WHERE user_email = X AND report_date = вчера)
  если has_entries → daily_status = 'green', событие green_day
  иначе → daily_status = 'red', событие red_day, событие streak_reset_timetracking
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

```
для каждого раздела L2:
  l3_assignees = все assignee_email задач L3 в этом L2
  violations_today = любое событие за сегодня с типом из (
    red_day, task_dynamics_violation
  ) WHERE user_email in l3_assignees

  если violations_today:
    событие section_red для L2
    событие streak_reset_section для тимлида L2
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
