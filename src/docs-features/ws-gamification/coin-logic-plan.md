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

Правило простое: штраф за внесение часов, если задача **ни разу не была** в статусе «В работе» в этот день. Отсутствие тега статуса (`NULL`) тоже считается нарушением — тег должен быть установлен.

### Как определить кастомный статус

В ответе `get_tasks` теги приходят в `tags: { "TAG_ID": "TAG_NAME", ... }`. Из набора тегов нужно найти тег, чей id входит в список id статусов (229565, 230943, 229569, 230828, 231517, 229577). Значение этого тега = текущий кастомный статус задачи.

### История смены статусов

WS API `get_events?period=1d` возвращает историю изменений, включая смену тегов:

```json
{
  "action": "update",
  "object": { "type": "task", "id": "4823388" },
  "date_added": "2026-04-15 21:11",
  "new": { "tags": ["10%", "Готово"] },
  "old": { "tags": ["10%", "В работе"] }
}
```

Это позволяет восстановить таймлайн статусов задачи за день без частого поллинга — один API-вызов в сутки.

---

## Механика 1: Штраф за отчёт в статусе ≠ «В работе» (−3 коина)

### Суть

Если сотрудник вносит отчёт времени (cost entry) в задачу L3, и задача **ни разу за этот день** не была в статусе «В работе» — списание **−3 коина**. Мотивация: сотрудники должны менять статус на «В работе» перед внесением времени.

**Презумпция невиновности:** если задача была «В работе» хотя бы в какой-то момент за день внесения часов — штрафа нет.

### Источник данных

- `get_costs` (вчера) → какие задачи получили cost entries
- `get_events?period=1d` → история смены тегов за день
- `ws_tasks_l3.custom_status` → текущий статус на момент синка

### Алгоритм определения нарушения

Для каждой задачи L3, куда вчера были внесены часы:

1. **Текущий статус** — из `ws_tasks_l3.custom_status` (после синка sync-ws-tasks)
2. **История за день** — из `get_events?period=1d`, отфильтровать `action=update`, `object.type=task`, найти смены тегов статуса
3. **Решение:**
   - Если текущий статус = «В работе» → **нет штрафа**
   - Если в истории событий за день есть хотя бы один момент, когда задача имела тег «В работе» (в `old.tags` или `new.tags`) → **нет штрафа**
   - Иначе → **штраф**

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
const PLANNING_STATUS_TAGS = new Set(['В работе', 'План', 'Пауза', 'Приостановлено', 'Согласование', 'Готово'])

function extractCustomStatus(tags?: Record<string, string>): string | null {
  if (!tags) return null
  for (const tagName of Object.values(tags)) {
    if (PLANNING_STATUS_TAGS.has(tagName)) return tagName
  }
  return null
}
```

В l3Rows добавить: `custom_status: extractCustomStatus(l3.tags)`.

#### 2. Новый скрипт / шаг: sync-task-events (VPS)

Отдельный шаг в оркестраторе (после sync-ws-costs, перед compute-gamification). Один API-вызов в сутки.

**Алгоритм:**

1. Вызвать `get_events?period=1d`
2. Отфильтровать: `action=update`, `object.type=task`
3. Из `old.tags` / `new.tags` извлечь смены статусов (теги из набора «Система планирования»)
4. Записать в таблицу `ws_task_status_changes`:

```sql
CREATE TABLE ws_task_status_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ws_task_id text NOT NULL,
  old_status text NULL,
  new_status text NULL,
  changed_at timestamptz NOT NULL,
  changed_by_email text NULL,
  event_date date NOT NULL,
  synced_at timestamptz DEFAULT now()
);

CREATE INDEX idx_task_status_changes_date ON ws_task_status_changes(event_date);
CREATE INDEX idx_task_status_changes_task ON ws_task_status_changes(ws_task_id, event_date);
```

**Парсинг тегов из events:**

```ts
const PLANNING_STATUS_TAGS = new Set(['В работе', 'План', 'Пауза', 'Приостановлено', 'Согласование', 'Готово'])

function extractStatusFromTags(tags: string[]): string | null {
  return tags.find(t => PLANNING_STATUS_TAGS.has(t)) ?? null
}

// Для каждого event:
const oldStatus = extractStatusFromTags(event.old?.tags ?? [])
const newStatus = extractStatusFromTags(event.new?.tags ?? [])
// Записать если oldStatus !== newStatus (реальная смена статуса)
```

#### 3. Определение нарушений в sync-ws-costs (VPS)

В `syncDaily()` при обработке вчерашних cost entries — сохранять привязку cost → task для последующей проверки.

**Новая таблица (промежуточная):**

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

**Логика определения (в compute-gamification, step 1c):**

1. Загрузить все cost entries за вчера из `ws_wrong_status_reports` (или напрямую — см. п.4)
2. Для каждой уникальной (user_email, ws_task_id, cost_date):
   a. Проверить `ws_tasks_l3.custom_status` → если «В работе» → пропустить
   b. Проверить `ws_task_status_changes` за этот день и задачу → если хотя бы одна запись содержит «В работе» (в `old_status` или `new_status`) → пропустить
   c. Иначе (статус ≠ «В работе» ИЛИ статус NULL) → штраф

#### 4. Альтернатива: без промежуточной таблицы `ws_wrong_status_reports`

Вместо сохранения нарушений в sync-ws-costs, можно в compute-gamification:
1. Загрузить `ws_daily_reports` за вчера → список (user_email, report_date)
2. Загрузить все cost entries за вчера через `get_costs` (повторный вызов API) → пары (user_email, task_id)
3. Проверить каждую пару

**Минус:** повторный API-вызов `get_costs`. **Плюс:** не нужна промежуточная таблица.

**Рекомендуется:** сохранять пары (user_email, task_id, date) в sync-ws-costs при обработке вчерашних данных — данные уже в руках, дополнительный API-вызов не нужен.

**Оптимальный подход:** расширить sync-ws-costs, чтобы помимо `ws_daily_reports` сохранять детализацию по задачам:

```sql
CREATE TABLE ws_daily_report_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  user_id uuid REFERENCES ws_users(id),
  ws_task_id text NOT NULL,
  cost_date date NOT NULL,
  hours numeric NOT NULL,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(user_email, ws_task_id, cost_date)
);
```

Это полезнее `ws_wrong_status_reports` — хранит все cost entries с привязкой к задачам, а не только нарушения. compute-gamification потом сам решает, какие из них — нарушения.

#### 5. Новый event_type

```sql
INSERT INTO gamification_event_types (key, name, coins, description, is_active)
VALUES ('wrong_status_report', 'Отчёт в неверном статусе задачи', -3, 'Время внесено в задачу L3 не в статусе «В работе»', true);
```

**Idempotency key:** `wrong_status_{user_id}_{ws_task_id}_{cost_date}`

Один штраф на пользователя + задачу + день (даже если внёс несколько записей в одну задачу за день).

**details:** `{ ws_task_id, ws_task_name, ws_project_id, task_status }`

#### 6. Админка (фронтенд)

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

-- 3. История смен статусов (из get_events)
CREATE TABLE ws_task_status_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ws_task_id text NOT NULL,
  old_status text NULL,
  new_status text NULL,
  changed_at timestamptz NOT NULL,
  changed_by_email text NULL,
  event_date date NOT NULL,
  synced_at timestamptz DEFAULT now()
);

CREATE INDEX idx_task_status_changes_date ON ws_task_status_changes(event_date);
CREATE INDEX idx_task_status_changes_task ON ws_task_status_changes(ws_task_id, event_date);

-- 4. Детализация cost entries по задачам
CREATE TABLE ws_daily_report_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  user_id uuid REFERENCES ws_users(id),
  ws_task_id text NOT NULL,
  cost_date date NOT NULL,
  hours numeric NOT NULL,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(user_email, ws_task_id, cost_date)
);

-- 5. Pending-таблица для проверки дедлайнов
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

-- 6. Новые event types
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
2. **sync-ws-costs** — дополнительно сохранять детализацию cost entries по задачам в `ws_daily_report_tasks`
3. **Новый шаг: sync-task-events** — вызов `get_events?period=1d`, парсинг смен статусов → `ws_task_status_changes`
4. **compute-gamification:**
   - Новый step 1c: wrong status check (чтение `ws_daily_report_tasks` + `ws_task_status_changes` + `ws_tasks_l3.custom_status` → события `wrong_status_report`)
   - Новый step 4.5: deadline check (30-дневная задержка, clawback)

**Порядок в оркестраторе:**

```
sync-ws-users → sync-ws-projects → sync-ws-tasks → sync-ws-costs
→ sync-task-events → snapshot-task-percent → sync-ws-absences
→ compute-gamification
```

sync-task-events идёт после sync-ws-costs, чтобы к моменту compute-gamification были и cost entries, и история статусов.

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

1. **Задача без кастомного статуса (тег не установлен):** `custom_status = NULL` — штраф **начисляется**. Тег статуса должен быть установлен, отсутствие тега = нарушение.

2. **Задача была «В работе» часть дня:** сотрудник поставил «В работе» → внёс часы → вернул «Пауза». В `ws_task_status_changes` будет запись, что задача была «В работе». Штрафа нет — презумпция невиновности.

3. **Задача без `date_end`:** не участвует в deadline check (аналогично задачам без `max_time` в budget check).

4. **`date_end` изменился после закрытия:** `deadline_pending` хранит `planned_end` на момент создания pending-записи. Если плановая дата была сдвинута — проверка идёт по оригинальному `planned_end`. Переоткрытие → новый pending с актуальным `date_end`.

5. **Одна задача, оба бонуса:** задача может получить и `budget_ok_l3` (+50) и `deadline_ok_l3` (+3) — это независимые механики.

6. **get_events period:** синк запускается в 00:00 по Минску (21:00 UTC предыдущего дня). Используем `period=1d1h` с фильтрацией по дате — гарантированно покрывает весь вчерашний рабочий день с запасом.
