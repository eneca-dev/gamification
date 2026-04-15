# Coin Logic — две новые механики

Две независимые механики: штраф за отчёт в «неправильном» статусе задачи и бонус за закрытие задачи до плановой даты. Обе применяются **только к задачам L3**.

---

## Статусы задач в Worksection

WS API поле `status` возвращает только `active` / `done` (открыта / закрыта). Кастомные статусы — это **теги из набора «Система планирования»** (group id 128):

| Тег (title)    | tag_id | Допускает внесение часов? |
|----------------|--------|--------------------------|
| В работе       | 229565 | **Да** |
| План           | 230943 | Нет |
| Пауза          | 229569 | Нет |
| Приостановлено | 230828 | Нет |
| Согласование   | 231517 | Нет |
| Готово          | 229577 | Нет |

Правило простое: штраф за внесение часов, если у задачи **нет тега «В работе» (id 229565)**.

### Как определить кастомный статус

В ответе `get_tasks` теги приходят в `tags: { "TAG_ID": "TAG_NAME", ... }`. Из набора тегов нужно найти тег, чей id входит в список id статусов (229565, 230943, 229569, 230828, 231517, 229577). Значение этого тега = текущий кастомный статус задачи.

---

## Механика 1: Штраф за отчёт в статусе ≠ «В работе» (−3 коина)

### Суть

Если сотрудник вносит отчёт времени (cost entry) в задачу L3, у которой кастомный статус **не** «В работе» — списание **−3 коина**. Мотивация: сотрудники должны менять статус на «В работе» перед внесением времени.

### Источник данных

WS API `get_costs` возвращает `WsCostEntry` с `task.id`. Кастомный статус задачи определяется через теги (`tags`) в `ws_tasks_l3`.

### Необходимые изменения

#### 1. Синхронизация кастомного статуса в sync-ws-tasks (VPS)

Сейчас sync-ws-tasks парсит `tags` только для извлечения процента (`extractPercent`). Нужно добавить извлечение кастомного статуса.

**Добавить колонку `custom_status` в `ws_tasks_l3`:**

```sql
ALTER TABLE ws_tasks_l3 ADD COLUMN custom_status text NULL;
```

Значения: `В работе`, `План`, `Пауза`, `Приостановлено`, `Согласование`, `Готово`, `NULL` (если тег не установлен).

**В sync-ws-tasks.ts:**

```ts
const PLANNING_STATUS_TAG_IDS = new Set(['229565', '230943', '229569', '230828', '231517', '229577'])

function extractCustomStatus(tags?: Record<string, string>): string | null {
  if (!tags) return null
  for (const [tagId, tagName] of Object.entries(tags)) {
    if (PLANNING_STATUS_TAG_IDS.has(tagId)) return tagName
  }
  return null
}
```

В l3Rows добавить: `custom_status: extractCustomStatus(l3.tags)`.

#### 2. Определение нарушений в sync-ws-costs (VPS)

В `syncDaily()` при обработке вчерашних cost entries — для каждого entry проверять кастомный статус задачи L3. Если статус ≠ «В работе» → записать в промежуточную таблицу.

**Логика в sync-ws-costs.ts (внутри syncDaily):**

1. Загрузить из БД `ws_tasks_l3` колонки `ws_task_id, custom_status` → Map<taskId, customStatus>
2. При обработке каждого cost entry: если `task.id` есть в L3 и `customStatus !== 'В работе'` и `customStatus !== null` → добавить в массив нарушений
3. По завершении — upsert нарушения в таблицу `ws_wrong_status_reports`

**Новая таблица:**

```sql
CREATE TABLE ws_wrong_status_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  user_id uuid REFERENCES ws_users(id),
  ws_task_id text NOT NULL,
  task_status text NOT NULL,
  cost_date date NOT NULL,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(user_email, ws_task_id, cost_date)
);
```

#### 3. Новый шаг в compute-gamification (VPS)

Добавить **Step 1c: Wrong status reports** между текущими step 1b (dynamics) и step 2 (day status).

Алгоритм:
1. Прочитать записи из `ws_wrong_status_reports` за вчера (`cost_date = yesterdayIso`)
2. Для каждой уникальной пары (user_email, ws_task_id, cost_date) → создать событие `wrong_status_report`
3. Резолвинг email → user_id через `ws_users` (стандартная логика)

#### 4. Новый event_type

```sql
INSERT INTO gamification_event_types (key, name, coins, description, is_active)
VALUES ('wrong_status_report', 'Отчёт в неверном статусе задачи', -3, 'Время внесено в задачу L3 не в статусе «В работе»', true);
```

**Idempotency key:** `wrong_status_{user_id}_{ws_task_id}_{cost_date}`

Один штраф на пользователя + задачу + день (даже если внёс несколько записей в одну задачу за день).

**details:** `{ ws_task_id, ws_task_name, ws_project_id, task_status }`

#### 5. Админка (фронтенд)

Стоимость штрафа (`-3`) хранится в `gamification_event_types` и редактируется через `/admin/events` (EventTypesTable с inline-редактированием). **Дополнительная работа по фронтенду не требуется** — новый event type автоматически появится в таблице событий после миграции.

---

## Механика 2: Бонус за закрытие задачи L3 до плановой даты (+3 коина)

### Суть

Если задача L3 закрыта **до или в** плановую дату (`date_end`) — бонус **+3 коина** исполнителю. Логика аналогична `budget_ok_l3`:
- При закрытии задачи создаётся pending-запись
- Ждём 30 дней (защита от переоткрытия)
- Если через 30 дней задача всё ещё закрыта и `date_closed ≤ date_end` → начисление
- Если задача переоткрыта до проверки → pending удаляется, при повторном закрытии отсчёт заново
- Если задача переоткрыта после approval → clawback (списание бонуса)

### Источник данных

WS API `get_tasks` возвращает `date_end` (дата завершения, формат YYYY-MM-DD). Сейчас это поле **не синхронизируется** в БД.

### Необходимые изменения

#### 1. Синхронизация `date_end` в sync-ws-tasks (VPS)

**Добавить колонку:**

```sql
ALTER TABLE ws_tasks_l3 ADD COLUMN date_end date NULL;
```

**В sync-ws-tasks.ts** — добавить `date_end: l3.date_end ?? null` в l3Rows.

Тип `date` (не `timestamptz`), т.к. WS API возвращает формат `YYYY-MM-DD` без времени.

#### 2. Таблица `deadline_pending`

Аналог `budget_pending`, но для сроков. Отдельная таблица, т.к. проверяемое условие другое (дата, не часы).

```sql
CREATE TABLE deadline_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ws_task_l3_id text REFERENCES ws_tasks_l3(ws_task_id),
  assignee_id uuid NOT NULL REFERENCES ws_users(id),
  assignee_email text NOT NULL,
  closed_at timestamptz NOT NULL,
  planned_end date NOT NULL,
  eligible_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'revoked')),
  checked_at timestamptz NULL
);
```

Без `ws_task_l2_id` — механика только для L3.

#### 3. Новые event types

```sql
INSERT INTO gamification_event_types (key, name, coins, description, is_active) VALUES
  ('deadline_ok_l3', 'Задача L3 закрыта в срок', 3, 'Задача закрыта до плановой даты (проверка через 30 дней)', true),
  ('deadline_revoked_l3', 'Отзыв бонуса за срок L3', -3, 'Бонус за срок отозван: задача переоткрыта после approval', true);
```

**Idempotency keys:**
- `deadline_ok_l3_{ws_task_id}_{user_id}`
- `deadline_revoked_l3_{ws_task_id}_{user_id}`

#### 4. Новый шаг в compute-gamification (VPS)

Добавить **Step 4.5: Deadline check** после бюджетных проверок (step 4). Структура полностью повторяет step 4 (budget).

Алгоритм:

**4.5a. Новые закрытия:**
- Все L3 где `date_closed IS NOT NULL`, `date_end IS NOT NULL`, `assignee_id IS NOT NULL`
- Нет записи в `deadline_pending` для этой задачи
- → INSERT в `deadline_pending` с `eligible_date = closed_at + 30 дней`

**4.5b. Переоткрытые (pending):**
- Записи в `deadline_pending` со статусом `pending`
- Если задача снова открыта (`ws_tasks_l3.date_closed IS NULL`) → DELETE pending
- При повторном закрытии step 4.5a создаст новую запись

**4.5c. Подошёл срок (eligible_date ≤ today):**
- Загрузить task из `ws_tasks_l3` (нужен актуальный `date_closed`)
- Сравнить: `date_closed ≤ planned_end`?
  - **Да** → `status = 'approved'`, создать event `deadline_ok_l3` (+3)
  - **Нет** → `status = 'revoked'` (не в срок — просто не даём бонус, штраф не начисляем)

**4.5d. Clawback (ревизия approved):**
- Записи со статусом `approved`
- Проверить: задача переоткрыта (`date_closed IS NULL`) ИЛИ `date_closed` изменилась и теперь `> planned_end`?
  - **Да** → создать event `deadline_revoked_l3`, `coins_override` из оригинальной транзакции, `status = 'revoked'`

#### 5. Админка (фронтенд)

Стоимость (+3 / −3) хранится в `gamification_event_types`, редактируется через `/admin/events`. Новые event types автоматически появятся. **Дополнительная работа по фронтенду не требуется.**

---

## Сводная миграция

Одна миграция со всеми изменениями:

```sql
-- 1. Кастомный статус задач L3
ALTER TABLE ws_tasks_l3 ADD COLUMN custom_status text NULL;

-- 2. Плановая дата завершения задач L3
ALTER TABLE ws_tasks_l3 ADD COLUMN date_end date NULL;

-- 3. Таблица нарушений статуса
CREATE TABLE ws_wrong_status_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  user_id uuid REFERENCES ws_users(id),
  ws_task_id text NOT NULL,
  task_status text NOT NULL,
  cost_date date NOT NULL,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(user_email, ws_task_id, cost_date)
);

-- 4. Pending-таблица для проверки дедлайнов
CREATE TABLE deadline_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ws_task_l3_id text REFERENCES ws_tasks_l3(ws_task_id),
  assignee_id uuid NOT NULL REFERENCES ws_users(id),
  assignee_email text NOT NULL,
  closed_at timestamptz NOT NULL,
  planned_end date NOT NULL,
  eligible_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'revoked')),
  checked_at timestamptz NULL
);

-- 5. Новые event types
INSERT INTO gamification_event_types (key, name, coins, description, is_active) VALUES
  ('wrong_status_report', 'Отчёт в неверном статусе задачи', -3, 'Время внесено в задачу L3 не в статусе «В работе»', true),
  ('deadline_ok_l3', 'Задача L3 закрыта в срок', 3, 'Задача закрыта до плановой даты (проверка через 30 дней)', true),
  ('deadline_revoked_l3', 'Отзыв бонуса за срок L3', -3, 'Бонус за срок отозван: задача переоткрыта после approval', true);
```

---

## Порядок реализации

### Этап 1: Миграция БД
Применить сводную миграцию (все изменения в одном файле).

### Этап 2: VPS-скрипты (gamification-vps-scripts)
1. **sync-ws-tasks** — сохранять `custom_status` (из тегов) и `date_end`
2. **sync-ws-costs** — при синке вчерашних данных определять cost entries на задачи L3 не в статусе «В работе» → писать в `ws_wrong_status_reports`
3. **compute-gamification** — новый step 1c (wrong status → events) + новый step 4.5 (deadline check с 30-дневной задержкой и clawback)

### Этап 3: Фронтенд (gamification)
Дополнительных изменений в фронтенде не требуется:
- Новые event types автоматически отображаются в `/admin/events`
- Транзакции показываются в `view_user_transactions`
- Баланс обновляется автоматически

### Этап 4: Документация
1. Обновить `src/docs/gamification-events.md` — добавить описание новых событий
2. Обновить `src/docs/gamification-db.md` — новые таблицы и колонки
3. Обновить `src/docs-features/ws-gamification/business-logic.md`

---

## Edge cases

1. **Задача без кастомного статуса (тег не установлен):** `custom_status = NULL` — штраф НЕ начисляется. Штраф только при явном статусе ≠ «В работе».

2. **Задача закрыта (status=done), но тег остался «В работе»:** WS API `status=done` означает закрытие через complete_task. Время во вчерашний синк попадает по `get_costs datestart=dateend=вчера` — если задача была закрыта до внесения времени, cost entry всё равно мог быть создан. Штраф в этом случае: зависит от `custom_status` в момент синка. Если тег «В работе» — штрафа нет, если «Готово» — штраф есть.

3. **Задача без `date_end`:** не участвует в deadline check (аналогично задачам без `max_time` в budget check).

4. **`date_end` изменился после закрытия:** deadline_pending хранит `planned_end` на момент создания pending-записи. Если плановая дата была сдвинута — проверка идёт по оригинальному `planned_end`. Переоткрытие → новый pending с актуальным `date_end`.

5. **Одна задача, оба бонуса:** задача может получить и `budget_ok_l3` (+50) и `deadline_ok_l3` (+3) — это независимые механики.
