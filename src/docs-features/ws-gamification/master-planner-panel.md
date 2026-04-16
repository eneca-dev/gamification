# Мастер планирования — вью, панель на дашборде, страница истории

## Контекст

В скрипте `compute-gamification.ts` (step 5) уже работает механика **master_planner** для L3:

- 10 последовательных L3-задач, закрытых в рамках бюджета → +450 коинов
- Любая L3 с превышением → сброс серии (`master_planner_reset`)
- Серия циклическая: каждые 10 → бонус
- События: `master_planner` (+450), `master_planner_reset` (0 коинов, `details.streak_was`)

### Что нужно изменить / добавить

1. **L2-стрик** — аналогичная серия для L2-задач, отдельный счётчик
2. **Revoke-логика** — `budget_revoked_l3/l2` должен пересчитывать стрик и отзывать бонусы (сейчас revoke не учитывается в мастере планирования)
3. **Вью** — `view_master_planner_history` для обогащения событий данными задач (название, ссылка)
4. **Таблица состояния** — `master_planner_state` для хранения вычисленного стрика (чтобы Next.js не дублировал логику пересчёта)
5. **Pending-секция** — задачи, ожидающие проверки бюджета (30-дневный период)
6. **UI** — панель на дашборде + страница истории

---

## Часть 0. Revoke-логика и пересчёт стрика (подход A2)

### Проблема

Когда задача, ранее закрытая в бюджете (`budget_ok_l3`), отзывается (`budget_revoked_l3`) из-за превышения бюджета после доработок — стрик мастера планирования не пересчитывается. Бонус +450, выданный на основе этой задачи, остаётся.

### Решение: полный пересчёт до целевого состояния (A2)

Каждый прогон `checkMasterPlanner` пересчитывает стрик с нуля:

```
1. Получить ВСЕ budget-события пользователя:
   budget_ok_l3, budget_exceeded_l3, budget_revoked_l3
   + details (для ws_task_id)
   сортировка: event_date ASC, created_at ASC (хронологический порядок)

2. Объединить с новыми событиями из текущего прогона.
   Новые события добавляются В КОНЕЦ списка (они за вчера — самые свежие,
   а список отсортирован ASC).

3. Собрать set отозванных ws_task_id:
   revokedIds = { details.ws_task_id из всех budget_revoked_l3 }

4. Отфильтровать поток:
   - Убрать budget_ok_l3, чей ws_task_id ∈ revokedIds
   - Оставить budget_exceeded_l3 как есть (они ломают серию)
   - budget_revoked_l3 сами по себе НЕ входят в поток
     (они лишь аннулируют соответствующий ok)

5. Один проход по отфильтрованному потоку, считая стрики:
   streak = 0, expectedBonuses = 0, currentCycleTasks = []
   lastExceededStreakWas = null, lastExceededTaskId = null, lastExceededIsNew = false

   for evt in filteredStream:
     if ok:
       streak++
       currentCycleTasks.push({id: evt.ws_task_id, name: evt.task_name})
       if streak % 10 == 0:
         expectedBonuses++
         сохранить currentCycleTasks для этого milestone
         currentCycleTasks = []   // начать новый цикл
     if exceeded:
       lastExceededStreakWas = streak
       lastExceededTaskId = evt.ws_task_id
       lastExceededIsNew = (evt из текущего прогона)
       streak = 0
       currentCycleTasks = []

6. Посчитать givenBonuses:
   количество master_planner событий минус количество master_planner_revoked

7. Привести к целевому:
   - expectedBonuses > givenBonuses → создать master_planner (+450)
   - expectedBonuses < givenBonuses → создать master_planner_revoked
     (через coins_override: найти оригинальную транзакцию master_planner
      и списать её точную сумму, а не фиксированную из справочника —
      на случай если админ менял сумму в gamification_event_types)

8. Если lastExceededIsNew && lastExceededStreakWas > 0:
   создать master_planner_reset (streak_was, exceeded_task_id)
   (revoke НЕ создаёт reset — только exceeded)

9. Сохранить состояние в master_planner_state:
   UPSERT (user_id, level) → current_streak, completed_cycles
```

### Важно: разница между exceeded и revoked

|                       | `budget_exceeded`                                                     | `budget_revoked`                                             |
| --------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| Что делает со стриком | Сбрасывает в 0                                                        | Убирает задачу из потока, стрик уменьшается                  |
| Создаёт reset         | Да (`master_planner_reset`)                                           | Нет                                                          |
| Может отозвать бонус  | Нет (exceeded сам по себе не отзывает, он просто ломает серию вперёд) | Да (`master_planner_revoked`, если бонус стал незаслуженным) |

### Пример пересчёта

```
Исходный поток (хронологический):
  ok(t1) ok(t2) ok(t3) ok(t4) ok(t5) ok(t6) ok(t7) ok(t8) ok(t9) ok(t10)
→ streak = 10 → master_planner выдан (+450), givenBonuses = 1

Задача t6 отозвана (budget_revoked_l3):
  revokedIds = {t6}

Отфильтрованный поток:
  ok(t1) ok(t2) ok(t3) ok(t4) ok(t5) ok(t7) ok(t8) ok(t9) ok(t10)
→ streak = 9 → expectedBonuses = 0

expectedBonuses(0) < givenBonuses(1)
→ создать master_planner_revoked (coins_override: -450, сумма из оригинальной транзакции)
```

### Пример: revoke в прошлой серии, текущая продолжается

```
Поток:
  ok(t1)..ok(t10) → master_planner(+450)
  ok(t11)..ok(t15) → streak = 15

Задача t3 отозвана:
  Отфильтрованный поток:
  ok(t1) ok(t2) ok(t4)..ok(t10) ok(t11)..ok(t15)
→ 14 подряд → expectedBonuses = 1 (milestone на 10-й)
→ givenBonuses = 1 → ничего не делаем
→ currentStreak = 14
```

### Idempotency

Старый формат ключей (`ws_master_planner_{user_id}_{streak}`) создаёт коллизии при revoke + re-earn: стрик может повторно достичь того же числа, ключ уже занят. Новый формат:

- `master_planner` (бонус): `ws_master_planner_v2_{user_id}_{date}_{n}` — date = дата прогона, n = порядковый номер бонуса в этом прогоне (обычно 1)
- `master_planner_revoked`: `ws_mp_revoked_{user_id}_{date}_{n}` — аналогично
- `master_planner_reset`: `ws_master_planner_reset_{user_id}_{date}` — без изменений (один reset на прогон)

### Обратная совместимость

В БД уже есть старые события `master_planner` с `details: {}` и ключами старого формата. Это не проблема:

- Новые ключи (`_v2_`) не пересекаются со старыми
- `givenBonuses` считается как `count(master_planner) - count(master_planner_revoked)` — старые события корректно учитываются
- Вью парсит `(details->>'milestone')::integer` — для старых записей вернёт NULL, UI покажет без номера milestone

### Details

Все события мастера планирования хранят в details ссылки на задачи — события самодостаточны для отображения в UI без дополнительных JOIN-ов:

| Событие                  | details                                                                 | Зачем                                                     |
| ------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------- |
| `master_planner`         | `{ milestone: 10, tasks: [{id:'t1',name:'...'}, ...] }`                 | UI: «Бонус за задачи: Дизайн главной, Рефакторинг API...» |
| `master_planner_reset`   | `{ streak_was: 7, exceeded_task: {id:'tX',name:'...'} }`                | UI: «Серия сброшена из-за задачи X»                       |
| `master_planner_revoked` | `{ expected: 0, given: 1, revoked_tasks: [{id:'tY',name:'...'}, ...] }` | UI: «Бонус отозван: бюджет превышен по задачам Y, Z»      |

Названия задач денормализованы в details — дополнительных JOIN-ов не нужно. Старые записи `master_planner` с `details: {}` — обратно совместимы: tasks будет NULL, UI покажет бонус без списка задач.

---

## Часть 1. Новые event types

### Миграция: INSERT в `gamification_event_types`

| key                         | coins | description                                       |
| --------------------------- | ----- | ------------------------------------------------- |
| `master_planner_l2`         | +400  | Мастер планирования L2: 10 задач подряд в бюджете |
| `master_planner_l2_reset`   | 0     | Сброс серии мастера планирования L2               |
| `master_planner_revoked`    | -450  | Отзыв бонуса мастера планирования L3              |
| `master_planner_l2_revoked` | -400  | Отзыв бонуса мастера планирования L2              |

Примечание: фактическая сумма списания при revoke берётся через `coins_override` из оригинальной транзакции, а не из справочника. Значения -450/-400 в таблице — fallback на случай если оригинал не найден.

---

## Часть 2. Таблица `master_planner_state`

### Назначение

Хранит вычисленное состояние стрика. Скрипт upsert-ит после каждого прогона, Next.js читает готовые значения. Это исключает дублирование логики пересчёта между VPS-скриптом и Next.js.

### Миграция

```sql
CREATE TABLE master_planner_state (
  user_id    uuid    NOT NULL REFERENCES profiles(user_id),
  level      text    NOT NULL CHECK (level IN ('l3', 'l2')),
  current_streak    integer NOT NULL DEFAULT 0,
  completed_cycles  integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, level)
);
```

### Как используется

- **Скрипт**: после пересчёта стрика для пользователя → `UPSERT master_planner_state SET current_streak = X, completed_cycles = Y`
- **Next.js queries.ts**: `SELECT * FROM master_planner_state WHERE user_id = $1` — получает готовые `currentStreak` и `completedCycles` для обоих уровней. Если строки нет — `currentStreak: 0, completedCycles: 0`.

---

## Часть 3. Изменения в `checkMasterPlanner` (VPS-скрипт)

### Рефакторинг: общая функция для L3 и L2

Текущий код работает только с L3. Вынести логику в параметризованную функцию:

```
async function computeMasterPlannerForLevel(
  user: { id: string, email: string },
  level: 'l3' | 'l2',
  yesterdayIso: string,
  events: NewEvent[],
  stats: ComputeStats,
)
```

Параметры по уровню:

|                | L3                       | L2                          |
| -------------- | ------------------------ | --------------------------- |
| ok event       | `budget_ok_l3`           | `budget_ok_l2`              |
| exceeded event | `budget_exceeded_l3`     | `budget_exceeded_l2`        |
| revoked event  | `budget_revoked_l3`      | `budget_revoked_l2`         |
| bonus event    | `master_planner`         | `master_planner_l2`         |
| revoke event   | `master_planner_revoked` | `master_planner_l2_revoked` |
| reset event    | `master_planner_reset`   | `master_planner_l2_reset`   |
| reward         | 450                      | 400                         |

### Алгоритм (внутри `computeMasterPlannerForLevel`)

```
1. Запрос: все budget-события пользователя для уровня
   .in('event_type', [ok, exceeded, revoked])
   .select('event_type, details')
   .order('event_date ASC, created_at ASC')

2. Объединить с новыми событиями из текущего прогона.
   Новые события добавляются В КОНЕЦ списка
   (ASC-сортировка, новые — самые свежие).

3. revokedIds = set(details.ws_task_id) из всех revoked-событий

4. Отфильтровать: убрать ok-события, чей ws_task_id ∈ revokedIds

4b. Для каждого события подгрузить название задачи из ws_tasks_l3/l2
    по details.ws_task_id (нужно для записи в details бонуса/revoke).
    Можно одним запросом: SELECT ws_task_id, name WHERE ws_task_id IN (...)

5. Один проход по отфильтрованному потоку:
   streak = 0, expectedBonuses = 0, currentCycleTasks = []
   lastExceededStreakWas = null, lastExceededTaskId = null, lastExceededIsNew = false

   for evt in filteredStream:
     if ok:
       streak++
       currentCycleTasks.push({id: evt.ws_task_id, name: evt.task_name})
       if streak % 10 == 0:
         expectedBonuses++
         сохранить currentCycleTasks для этого milestone
         currentCycleTasks = []
     if exceeded:
       lastExceededStreakWas = streak
       lastExceededTaskId = evt.ws_task_id
       lastExceededIsNew = (evt из текущего прогона)
       streak = 0
       currentCycleTasks = []

6. Отдельный запрос: givenBonuses
   SELECT event_type, count(*) FROM gamification_event_logs
   WHERE user_id = $1 AND event_type IN (bonus, revoke)
   GROUP BY event_type
   givenBonuses = count(bonus) - count(revoke)
   Также учесть bonus/revoke из текущего массива events.

7. diff = expectedBonuses - givenBonuses
   if diff > 0 → создать bonus событие(я)
     details: { milestone: N, tasks: [{id, name}, ...] }
   if diff < 0 → создать revoke событие(я)
     найти оригинальную транзакцию bonus,
     coins_override = -abs(оригинальные коины)
     details: { expected, given, revoked_tasks: [{id, name}, ...все новые revoked] }

8. Если lastExceededIsNew && lastExceededStreakWas > 0:
   создать reset
   details: { streak_was: lastExceededStreakWas, exceeded_task: {id, name} }
   (revoke НЕ создаёт reset)

9. UPSERT master_planner_state:
   (user_id, level) → current_streak = streak, completed_cycles = expectedBonuses
```

### `checkMasterPlanner` вызывает:

```
for (const user of users) {
  await computeMasterPlannerForLevel(user, 'l3', yesterdayIso, events, stats)
  await computeMasterPlannerForLevel(user, 'l2', yesterdayIso, events, stats)
}
```

---

## Часть 4. Миграция: вью `view_master_planner_history`

### Назначение

Обогащает события мастера планирования (L3 и L2) данными задач для UI. Для budget-событий (`budget_ok/exceeded/revoked`) — JOIN по `details->>'ws_task_id'`. Для `master_planner_reset` — JOIN по `details->'exceeded_task'->>'id'` (задача-причина сброса). Для `master_planner` и `master_planner_revoked` — task_name NULL (ссылки на задачи в массивах `milestone_tasks` / `revoked_tasks`).

### SQL

```sql
-- Новые event types
INSERT INTO gamification_event_types (key, coins, description, source) VALUES
  ('master_planner_l2', 400, 'Мастер планирования L2: 10 задач подряд в бюджете', 'ws'),
  ('master_planner_l2_reset', 0, 'Сброс серии мастера планирования L2', 'ws'),
  ('master_planner_revoked', -450, 'Отзыв бонуса мастера планирования L3', 'ws'),
  ('master_planner_l2_revoked', -400, 'Отзыв бонуса мастера планирования L2', 'ws')
ON CONFLICT (key) DO NOTHING;

-- Таблица состояния
CREATE TABLE master_planner_state (
  user_id    uuid    NOT NULL REFERENCES profiles(user_id),
  level      text    NOT NULL CHECK (level IN ('l3', 'l2')),
  current_streak    integer NOT NULL DEFAULT 0,
  completed_cycles  integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, level)
);

-- Вью
CREATE OR REPLACE VIEW view_master_planner_history AS

-- L3 события
SELECT
  el.id                                           AS event_id,
  el.user_id,
  el.user_email,
  el.event_type,
  el.event_date,
  el.created_at,
  'L3'::text                                     AS level,
  -- Задача: для budget-событий — ws_task_id, для reset — exceeded_task.id
  COALESCE(
    el.details->>'ws_task_id',
    el.details->'exceeded_task'->>'id'
  )                                               AS ws_task_id,
  t3.name                                         AS task_name,
  t3.ws_project_id,
  t2_parent.parent_l1_id                          AS ws_l1_id,
  (el.details->>'max_time')::numeric              AS max_time,
  (el.details->>'actual_time')::numeric           AS actual_time,
  (el.details->>'streak_was')::integer            AS streak_was,
  (el.details->>'milestone')::integer             AS milestone,
  el.details->'tasks'                              AS milestone_tasks,
  (el.details->>'expected')::integer              AS revoke_expected,
  (el.details->>'given')::integer                 AS revoke_given,
  el.details->'revoked_tasks'                      AS revoked_tasks,
  tr.coins
FROM gamification_event_logs el
LEFT JOIN ws_tasks_l3 t3
  ON t3.ws_task_id = COALESCE(
    el.details->>'ws_task_id',
    el.details->'exceeded_task'->>'id'
  )
LEFT JOIN ws_tasks_l2 t2_parent
  ON t2_parent.ws_task_id = t3.parent_l2_id
LEFT JOIN gamification_transactions tr
  ON tr.event_id = el.id
WHERE el.event_type IN (
  'budget_ok_l3', 'budget_exceeded_l3', 'budget_revoked_l3',
  'master_planner', 'master_planner_reset', 'master_planner_revoked'
)

UNION ALL

-- L2 события
SELECT
  el.id                                           AS event_id,
  el.user_id,
  el.user_email,
  el.event_type,
  el.event_date,
  el.created_at,
  'L2'::text                                     AS level,
  COALESCE(
    el.details->>'ws_task_id',
    el.details->'exceeded_task'->>'id'
  )                                               AS ws_task_id,
  t2.name                                         AS task_name,
  t2.ws_project_id,
  t2.parent_l1_id                                 AS ws_l1_id,
  (el.details->>'max_time')::numeric              AS max_time,
  (el.details->>'actual_time')::numeric           AS actual_time,
  (el.details->>'streak_was')::integer            AS streak_was,
  (el.details->>'milestone')::integer             AS milestone,
  el.details->'tasks'                              AS milestone_tasks,
  (el.details->>'expected')::integer              AS revoke_expected,
  (el.details->>'given')::integer                 AS revoke_given,
  el.details->'revoked_tasks'                      AS revoked_tasks,
  tr.coins
FROM gamification_event_logs el
LEFT JOIN ws_tasks_l2 t2
  ON t2.ws_task_id = COALESCE(
    el.details->>'ws_task_id',
    el.details->'exceeded_task'->>'id'
  )
LEFT JOIN gamification_transactions tr
  ON tr.event_id = el.id
WHERE el.event_type IN (
  'budget_ok_l2', 'budget_exceeded_l2', 'budget_revoked_l2',
  'master_planner_l2', 'master_planner_l2_reset', 'master_planner_l2_revoked'
);
```

### Поля вью

| Поле              | Тип         | Описание                                                                                                                      |
| ----------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `event_id`        | uuid        | PK события                                                                                                                    |
| `user_id`         | uuid        | Пользователь                                                                                                                  |
| `user_email`      | text        | Email                                                                                                                         |
| `event_type`      | text        | Тип события                                                                                                                   |
| `event_date`      | date        | Дата                                                                                                                          |
| `created_at`      | timestamptz | Время создания                                                                                                                |
| `level`           | text        | `'L3'` / `'L2'`                                                                                                               |
| `ws_task_id`      | text        | ID задачи: основная (budget_ok/exceeded/revoked) или причина сброса (reset). NULL для master_planner и master_planner_revoked |
| `task_name`       | text        | Название задачи (JOIN). NULL для master_planner (список в milestone_tasks) и master_planner_revoked (список в revoked_tasks)  |
| `ws_project_id`   | text        | ID проекта (для URL)                                                                                                          |
| `ws_l1_id`        | text        | ID задачи L1 (для URL)                                                                                                        |
| `max_time`        | numeric     | Бюджет часов                                                                                                                  |
| `actual_time`     | numeric     | Фактические часы                                                                                                              |
| `streak_was`      | integer     | Длина серии до сброса (reset)                                                                                                 |
| `milestone`       | integer     | Milestone стрика (10, 20...) — NULL для старых записей                                                                        |
| `milestone_tasks` | jsonb       | Массив `[{id, name}, ...]` задач, входящих в milestone (master_planner) — NULL для остальных                                  |
| `revoke_expected` | integer     | Ожидаемое кол-во бонусов (revoked)                                                                                            |
| `revoke_given`    | integer     | Фактическое кол-во бонусов до отзыва (revoked)                                                                                |
| `revoked_tasks`   | jsonb       | Массив `[{id, name}, ...]` задач, из-за которых отозван бонус (master_planner_revoked) — NULL для остальных                   |
| `coins`           | integer     | Коины транзакции                                                                                                              |

### Какие данные есть по типу события

| event_type               | task_name                 | max/actual_time | streak_was | milestone | milestone_tasks   | revoked_tasks     | coins                       |
| ------------------------ | ------------------------- | --------------- | ---------- | --------- | ----------------- | ----------------- | --------------------------- |
| `budget_ok_*`            | Задача                    | Да              | —          | —         | —                 | —                 | Сумма начисления (+50/+200) |
| `budget_exceeded_*`      | Задача                    | Да              | —          | —         | —                 | —                 | NULL (информационное)       |
| `budget_revoked_*`       | Задача                    | Да              | —          | —         | —                 | —                 | Сумма списания              |
| `master_planner`         | NULL                      | —               | —          | 10/20/30  | `[{id,name},...]` | —                 | +450/+400                   |
| `master_planner_reset`   | Задача-причина (exceeded) | —               | Да         | —         | —                 | —                 | NULL (информационное)       |
| `master_planner_revoked` | NULL                      | —               | —          | —         | —                 | `[{id,name},...]` | Сумма списания              |

### URL задачи в WS (строится на клиенте)

Формат: `https://eneca.worksection.com/project/{ws_project_id}/{ws_l1_id}/{ws_task_id}/`

- L3: `/project/{projectID}/{l1_task_id}/{l3_task_id}/`
- L2: `/project/{projectID}/{l1_task_id}/{l2_task_id}/`

---

## Часть 5. Блок «Мастер планирования» в StreakPanel

### Что убираем

- Правую часть `InlineDailyQuests` из `StreakPanel.tsx`
- Пропс `tasks` из `StreakPanelProps`

### Что добавляем (правая колонка)

**Заголовок:** «Мастер планирования» с иконкой

**Два стрика (один под другим, стиль CompactStreakRow):**

| Стрик           | Считает               | Exceeded (streak = 0) | Revoked (задача убрана, streak--) | Награда           |
| --------------- | --------------------- | --------------------- | --------------------------------- | ----------------- |
| L3 Исполнитель  | `budget_ok_l3` подряд | `budget_exceeded_l3`  | `budget_revoked_l3`               | +450 за каждые 10 |
| L2 Руководитель | `budget_ok_l2` подряд | `budget_exceeded_l2`  | `budget_revoked_l2`               | +400 за каждые 10 |

Для каждого стрика:

- Текущая серия (X из 10) + прогресс-бар
- Завершённые циклы (бейдж Nx)

**Ожидают 30 дней (pending):**

- Компактный список задач из `budget_pending` со статусом `pending`
- Для каждой: название задачи, обратный отсчёт (осталось X дней до проверки)
- Чтобы пользователь видел, что процесс идёт (иначе панель может казаться "мёртвой")

**Последние события (компактный список, 3-5 штук, L3+L2 вместе):**

- Иконка статуса + уровень (L3/L2) + название задачи + дата
- Зелёная галочка — budget_ok (в бюджете)
- Красный крестик — budget_exceeded (превышение)
- Оранжевый крестик — budget_revoked (отозвано после доработок)
- Трофей — master_planner (бонус)
- Красный трофей — master_planner_revoked (бонус отозван)

**Кнопка-ссылка:** «История» → `/master-planner`

### Данные

**Стрики** — из `master_planner_state` (готовые значения, без дублирования логики):

```sql
SELECT * FROM master_planner_state WHERE user_id = $1
```

Если строки нет — `currentStreak: 0, completedCycles: 0`.

**Последние события** — из вью:

```sql
SELECT * FROM view_master_planner_history
WHERE user_id = $1
ORDER BY event_date DESC, created_at DESC
LIMIT 5
```

**Pending** — из существующей `view_budget_pending_status`:

```sql
SELECT * FROM view_budget_pending_status
WHERE user_id = $1 AND status = 'pending'
ORDER BY eligible_date ASC
```

### Типы

```
MasterPlannerPanelData:
  l3:
    currentStreak: number
    completedCycles: number
    reward: 450
  l2:
    currentStreak: number
    completedCycles: number
    reward: 400
  recentEvents: MasterPlannerEvent[]
  pendingTasks: PendingBudgetTask[]

MasterPlannerEvent:
  type: string
  level: 'L3' | 'L2'
  date: string
  taskName: string | null
  taskUrl: string | null
  maxTime: number | null
  actualTime: number | null
  coins: number | null
  streakWas: number | null

PendingBudgetTask:
  level: 'L3' | 'L2'
  taskName: string
  taskUrl: string | null
  daysRemaining: number
```

---

## Часть 6. Страница истории `/master-planner`

### Роут

`src/app/(main)/master-planner/page.tsx` + `loading.tsx`

### Содержимое

**Шапка:**

- Заголовок «Мастер планирования»
- Два стрика (L3 + L2) с прогрессом (крупнее, чем в панели) — из `master_planner_state`
- Итого бонусов: отдельно L3 и L2

**Табы:** L3 / L2 / Все

**Таблица событий:**

| Столбец | Источник                                                                                                                                                                      |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Дата    | `event_date`                                                                                                                                                                  |
| Уровень | `level`                                                                                                                                                                       |
| Тип     | Иконка + текст по `event_type`                                                                                                                                                |
| Задача  | `task_name` + ссылка WS (для budget-событий и reset); для master_planner — раскрывающийся список из `milestone_tasks`; для master_planner_revoked — список из `revoked_tasks` |
| Бюджет  | `actual_time` / `max_time` ч (только для budget-событий)                                                                                                                      |
| Серия   | Номер в серии или «Сброс» / «Отозвано» (см. ниже)                                                                                                                             |
| Коины   | `coins`                                                                                                                                                                       |

**Вычисление номера в серии (streak_position):**

Серверная пагинация (LIMIT/OFFSET по вью) + доп. запрос для определения стартовой позиции.

**Два запроса в `queries.ts` для каждой страницы:**

1. **Основной** — данные страницы:

   ```sql
   SELECT * FROM view_master_planner_history
   WHERE user_id = $1 AND level = $2
   ORDER BY event_date DESC, created_at DESC
   LIMIT 20 OFFSET $3
   ```

2. **Доп. запрос** — определить startPosition для нижней строки страницы
   (сколько подряд ok было ДО самого старого события на странице):

   ```sql
   SELECT event_type FROM view_master_planner_history
   WHERE user_id = $1 AND level = $2
   ORDER BY event_date DESC, created_at DESC
   OFFSET $3   -- offset + page_size (= первая запись СТАРШЕ текущей страницы)
   LIMIT 200   -- safety cap
   ```

   В `queries.ts`: пройти от начала результата (это события старше страницы,
   от новых к старым), считать подряд `budget_ok` до первого `exceeded`/`reset`.
   Результат = startPosition для нижней строки текущей страницы.

   Для первой страницы при `offset + page_size >= totalCount` — startPosition = 0
   (начало истории, серия стартует с 1).

**Нумерация на клиенте:**
Страница содержит 20 записей (DESC: сверху новые, снизу старые).
Клиент проходит снизу вверх (от старых к новым):

- `budget_ok` → position (startPosition + порядковый номер ok, считая снизу)
- `budget_exceeded` / `master_planner_reset` → position = 0, отображаем «Сброс»
- `budget_revoked` → отображаем «Отозвано» (position не меняется)
- `master_planner` → отображаем «Бонус (цикл N)»
- `master_planner_revoked` → отображаем «Бонус отозван»

**Оценка нагрузки:** доп. запрос возвращает максимум длину текущей серии (обычно 10-50 строк, cap 200). Даже при 1000+ задач за год — миллисекунды.

**Визуальные маркеры:**

- `budget_ok_*` — обычный фон
- `budget_exceeded_*` — красный фон, текст «Превышение бюджета»
- `budget_revoked_*` — оранжевый фон, текст «Отозвано (бюджет превышен после доработок)»
- `master_planner` / `master_planner_l2` — зелёный фон, текст «Бонус +450/+400»
- `master_planner_revoked` / `master_planner_l2_revoked` — красный фон, текст «Бонус отозван -450/-400»
- `master_planner_reset` / `master_planner_l2_reset` — серый фон, текст «Серия сброшена (было X)»
- Между сериями — визуальный разделитель

**Пагинация:** серверная, по 20 записей

---

## Часть 7. Файловая структура

```
supabase/migrations/
  NNN_create_master_planner_events_state_and_view.sql

src/modules/master-planner/
  types.ts
  queries.ts              — getMasterPlannerPanel(userId), getMasterPlannerHistory(userId, page, level?)
  components/
    MasterPlannerPanel.tsx — правая колонка StreakPanel
    MasterPlannerHistory.tsx — таблица для страницы истории
  index.ts

src/app/(main)/master-planner/
  page.tsx
  loading.tsx

src/docs/master-planner.md
```

### Изменения в существующих файлах

| Файл                            | Изменение                                                             |
| ------------------------------- | --------------------------------------------------------------------- |
| `StreakPanel.tsx`               | Убрать `InlineDailyQuests`, добавить `MasterPlannerPanel`             |
| `streak-panel/types.ts`         | Добавить `masterPlanner?: MasterPlannerPanelData` или отдельный пропс |
| `app/(main)/page.tsx`           | Добавить запрос данных мастера, передать в StreakPanel                |
| `compute-gamification.ts` (VPS) | Рефакторинг checkMasterPlanner: A2-алгоритм + L2-стрик + UPSERT state |
| `gamification-events.md`        | Добавить 4 новых event types                                          |
| `business-logic.md`             | Добавить раздел «Мастер планирования»                                 |

---

## Часть 8. Порядок реализации

### Шаг 0. Миграция

- INSERT 4 новых event types
- CREATE TABLE `master_planner_state`
- CREATE VIEW `view_master_planner_history`
- Проверить данные

### Шаг 1. VPS-скрипт — рефакторинг `checkMasterPlanner`

- Вынести логику в `computeMasterPlannerForLevel(user, level, ...)`
- Реализовать A2-алгоритм (полный пересчёт с фильтрацией revoked)
- Записывать tasks, exceeded_task, revoked_tasks (с названиями) в details
- coins_override для revoke (точная сумма из оригинальной транзакции)
- Добавить L2-стрик
- UPSERT `master_planner_state` после каждого пользователя
- Обновить stats

### Шаг 2. Модуль `master-planner` (types + queries)

- `types.ts`
- `queries.ts` — читает `master_planner_state` + вью + `view_budget_pending_status`
- `index.ts`

### Шаг 3. Компонент `MasterPlannerPanel`

- Два стрика (L3 + L2)
- Секция pending-задач
- Список последних событий
- Ссылка на историю

### Шаг 4. Интеграция в StreakPanel

- Убрать `InlineDailyQuests`
- Добавить `MasterPlannerPanel`
- Обновить `page.tsx`

### Шаг 5. Страница `/master-planner`

- `page.tsx` + `loading.tsx`
- `MasterPlannerHistory` с таблицей, табами L3/L2, пагинацией

### Шаг 6. Документация

- `src/docs/master-planner.md`
- Обновить `gamification-events.md`
- Обновить `business-logic.md`
- Обновить `streak-panel.md`

---

## Решённые вопросы

1. **Ежедневные задания** — `InlineDailyQuests` убираем полностью, никуда не переносим.
2. **Sidebar** — пункта «Мастер планирования» в навигации нет. Доступ только через панель на главной + ссылка «История» → `/master-planner`.
3. **Награда L2** — 400 коинов (настраивается в админке через `gamification_event_types`).
4. **Revoke** — полный пересчёт (A2): revoke убирает задачу из потока, стрик уменьшается, бонусы отзываются через coins_override. Reset создаётся только при exceeded, не при revoke.
5. **Дублирование логики** — скрипт сохраняет состояние в `master_planner_state`, Next.js читает готовые значения.
6. **Обратная совместимость** — старые master*planner с `details: {}` корректно учитываются. Новые idempotency keys используют префикс `\_v2*`, не пересекаются со старыми.
7. **Details** — все события мастера хранят ссылки на задачи с названиями (денормализовано): `tasks: [{id, name}]` (бонус), `exceeded_task: {id, name}` (сброс), `revoked_tasks: [{id, name}]` (отзыв). Дополнительных JOIN-ов для UI не нужно.
8. **Streak position** — серверная пагинация + доп. запрос для startPosition (сколько подряд ok до текущей страницы). Клиент нумерует на основе startPosition. Доп. запрос лёгкий — максимум длина текущей серии (10-50 строк).
