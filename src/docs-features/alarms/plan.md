# Alarms — Система предупреждений

> Дата: 2026-03-30
> Статус: Проектирование

## Цель

Предотвращение красных дней через упреждающие уведомления. Два потока: исполнитель (L3) и тимлид (L2). Расчёт на VPS-скриптах, хранение в отдельной таблице, отображение баннером на дашборде под стрик-панелью.

---

## Типы предупреждений

### Для исполнителя (assignee L3)

| Тип | Severity | Описание | Условие |
|-----|----------|----------|---------|
| `label_change_soon` | warning | Пора сменить метку прогресса | Бюджет задачи в пределах 5% до следующего чекпоинта (15→20, 35→40, 55→60, 75→80, 95→100), а метка не менялась с последнего чекпоинта |
| `no_timetracking` | critical | Не списаны часы за вчера | Нет записи в `ws_daily_reports` за предыдущий рабочий день. Фиксирует факт — красный день уже случился |

### Для тимлида (assignee L2)

| Тип | Severity | Описание | Условие |
|-----|----------|----------|---------|
| `team_label_change_soon` | warning | Задача в секции приближается к чекпоинту | L3 в его секции в пределах 5% до чекпоинта, метка не менялась |
| `team_label_changed` | info | Метка задачи в секции была сменена | Факт смены метки L3 в его секции: кто, какая задача, с какого на какой % |
| `no_timetracking` | critical | Не списаны часы за вчера | Тимлид тоже обязан списывать часы — аналогично исполнителю |
| `section_violation` | critical | Нарушение динамики в секции | L3 в секции пересёк чекпоинт без смены метки — section_red уже произошёл |

---

## Логика расчёта (VPS-скрипт)

Новый шаг в `compute-gamification.ts` — **после Step 6 (транзакции)**, функция `generateAlarms()`.

### Алгоритм

```
generateAlarms():
  1. Удалить нерешённые алармы за сегодня (DELETE WHERE alarm_date = today AND is_resolved = false)
     Решённые алармы (is_resolved = true) сохраняются в истории.

  2. Алармы по таймтрекингу (no_timetracking):
     - Для каждого активного юзера без записи в ws_daily_reports за вчера
     - Создать аларм severity=critical
     - Если юзер — assignee L2, аларм получает тот же юзер (тимлид тоже списывает)

  3. Алармы по меткам — предупреждение (label_change_soon):
     - Для каждой открытой L3 (date_closed IS NULL, max_time > 0):
       a. budgetPercent = (actualHours / maxTime) * 100
       b. nextCheckpoint = (Math.floor(budgetPercent / 20) + 1) * 20
       c. distanceToCheckpoint = nextCheckpoint - budgetPercent
       d. Если distanceToCheckpoint <= 5 AND distanceToCheckpoint > 0:
          - Проверить: менялась ли метка с момента последнего чекпоинта
          - Если НЕ менялась → аларм label_change_soon для assignee L3
          - + аларм team_label_change_soon для assignee L2 (тимлид секции)

  4. Алармы по сменённым меткам (team_label_changed):
     - Сравнить ws_task_percent_snapshots за вчера и сегодня
     - Для задач, где percent изменился:
       - Найти parent_l2_id → assignee L2
       - Создать аларм info для тимлида с деталями (кто, задача, было→стало)

  5. Алармы по нарушениям секций (section_violation):
     - Если в текущем прогоне были созданы события section_red:
       - Для каждого section_red → аларм critical для тимлида

  6. Batch INSERT всех алармов в таблицу
```

### Порог предупреждения

Чекпоинты: кратные 20%, **без верхней границы** — 20/40/60/80/100/120/140/… (консистентно с `compute-gamification`).
Предупреждение срабатывает когда бюджет в диапазоне `[checkpoint - 5%, checkpoint)`.

Примеры:
- Бюджет 36% → до чекпоинта 40% осталось 4% → аларм
- Бюджет 34% → до чекпоинта 40% осталось 6% → нет аларма
- Бюджет 42% → чекпоинт 40% уже пройден, следующий 60%, до него 18% → нет аларма
- Бюджет 117% → следующий чекпоинт 120%, осталось 3% → аларм (задача в перерасход, но проверки продолжаются)

### Идемпотентность и история

История алармов хранится. Каждый прогон:
1. Удаляет нерешённые (`is_resolved = false`) алармы за текущую дату
2. Вставляет новые алармы за текущую дату
3. Решённые алармы (`is_resolved = true`) остаются в таблице навсегда

Это позволяет:
- Видеть аналитику: сколько предупреждений юзер получал за месяц
- Не терять факт, что юзер отреагировал на аларм (поставил галочку)
- Фронтенд показывает алармы за сегодня с `is_resolved = false`

---

## Схема БД

### Таблица `alarms`

```sql
CREATE TABLE alarms (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  user_email text NOT NULL,
  alarm_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  title text NOT NULL,
  description text,
  ws_task_id text,
  ws_task_name text,
  ws_task_url text,
  ws_project_id text,
  details jsonb NOT NULL DEFAULT '{}',
  alarm_date date NOT NULL DEFAULT CURRENT_DATE,
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT alarms_type_check CHECK (alarm_type IN (
    'label_change_soon',
    'team_label_change_soon',
    'team_label_changed',
    'no_timetracking',
    'section_violation'
  )),
  CONSTRAINT alarms_severity_check CHECK (severity IN ('info', 'warning', 'critical'))
);

CREATE INDEX idx_alarms_user_date ON alarms (user_id, alarm_date);
CREATE INDEX idx_alarms_date ON alarms (alarm_date);
```

### Поле `details` (JSONB)

Содержимое зависит от типа аларма:

**`label_change_soon` / `team_label_change_soon`:**
```json
{
  "budget_percent": 37.5,
  "next_checkpoint": 40,
  "current_label": 20,
  "last_checkpoint": 20,
  "actual_hours": 15,
  "max_time": 40,
  "assignee_email": "user@company.com",
  "assignee_name": "Иванов Иван"
}
```

**`team_label_changed`:**
```json
{
  "previous_label": 40,
  "new_label": 60,
  "changed_by_email": "user@company.com",
  "changed_by_name": "Петров Пётр"
}
```

**`no_timetracking`:**
```json
{
  "missing_date": "2026-03-29"
}
```

**`section_violation`:**
```json
{
  "violating_task_id": "12345",
  "violating_task_name": "Задача X",
  "violating_user_email": "user@company.com",
  "violating_user_name": "Сидоров Андрей",
  "checkpoint_crossed": 40
}
```

---

## RLS-политика

```sql
ALTER TABLE alarms ENABLE ROW LEVEL SECURITY;

-- Юзер видит только свои алармы (включая team_* алармы, адресованные ему как ответственному за L2)
CREATE POLICY "Users can view own alarms"
  ON alarms FOR SELECT
  USING (auth.uid() = user_id);

-- Юзер может отмечать свои алармы как решённые
CREATE POLICY "Users can resolve own alarms"
  ON alarms FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Кто какие алармы видит

Все алармы адресованы конкретному `user_id`. Разделение по ролям происходит на этапе генерации:

- **Исполнитель L3** получает: `label_change_soon`, `no_timetracking` — про свои задачи и часы
- **Ответственный за L2** получает: `team_label_change_soon`, `team_label_changed`, `section_violation`, `no_timetracking` — про задачи L3 в своей секции + свои часы

Один юзер может быть и исполнителем L3, и ответственным за L2 — он увидит оба набора алармов в одном списке.

---

## Фронтенд

### Расположение на дашборде

Текущий порядок:
```
1. AlertsBanner (старый, убрать)
2. StreakPanel
3. TransactionFeed + Leaderboard
4. DepartmentContest
```

Новый порядок:
```
1. StreakPanel
2. AlarmsBanner (новый, данные из таблицы alarms)
3. TransactionFeed + Leaderboard
4. DepartmentContest
```

### Модуль `src/modules/alarms/`

```
src/modules/alarms/
  queries.ts        — getAlarms(userId): читает нерешённые алармы за сегодня
  actions.ts        — resolveAlarm(alarmId): отмечает аларм как решённый
  types.ts          — Alarm, AlarmType, AlarmSeverity
  components/
    AlarmsBanner.tsx — баннер с группировкой по severity
  index.ts          — публичный API (серверный)
  index.client.ts   — клиентский API (resolveAlarm action, типы)
```

### UI компонент AlarmsBanner

- Группировка: critical сверху, затем warning, затем info
- Цвета по severity:
  - `critical` — красный фон (--apex-red)
  - `warning` — жёлтый/оранжевый фон (--apex-amber)
  - `info` — синий фон (--apex-blue)
- Каждый аларм показывает:
  - Иконку severity
  - Title и description
  - Название задачи как **кликабельную ссылку** на задачу в WS (поле `ws_task_url`, открывается в новой вкладке)
  - **Чекбокс "Выполнено"** — отмечает аларм как решённый (`resolveAlarm` action), аларм плавно исчезает из списка
- Сворачиваемый: если > 3 алармов, показать первые 3 + кнопка "Показать все (N)"
- Анимация появления: `animate-fade-in-up`, анимация исчезновения при resolve
- Если алармов нет — компонент не рендерится

### Взаимодействие с чекбоксом

AlarmsBanner — клиентский компонент (`'use client'`). При клике на чекбокс:
1. Optimistic update: аларм визуально исчезает мгновенно
2. Вызов `resolveAlarm(alarmId)` — Server Action обновляет `is_resolved = true`, `resolved_at = now()`
3. При ошибке — аларм возвращается обратно в список

### Ссылка на задачу

URL формируется скриптом из `ws_project_id` + `ws_task_id` по шаблону `https://eneca.worksection.com/project/{project_id}/{task_id}/`. Сохраняется в поле `ws_task_url`. Если задачи нет (например, `no_timetracking`) — `ws_task_url = null`, ссылка не показывается.

### Данные

Server Component на дашборде вызывает `getAlarms(userId)` — нерешённые алармы за сегодня. Передаёт в `AlarmsBanner` через props. Данные обновляются раз в сутки, SSR достаточно для первоначальной загрузки. Optimistic update при resolve — через клиентский стейт.

---

## Интеграция с VPS-скриптами

### Изменения в `compute-gamification.ts`

1. Импортировать новую функцию `generateAlarms` из `src/scripts/generate-alarms.ts`
2. Вызвать после `createTransactions()` (Step 6)
3. Передать контекст: `events[]`, `statusMap`, дату

### Новый файл `src/scripts/generate-alarms.ts`

Отдельный файл для генерации алармов. Принимает:
- Список событий текущего прогона (для section_violation)
- Дату расчёта
- Использует Supabase client для чтения задач и записи алармов

### Данные для расчёта (что читает из БД)

| Таблица | Зачем |
|---------|-------|
| `ws_users` | Активные пользователи |
| `ws_tasks_l3` | Открытые задачи с бюджетом |
| `ws_tasks_l2` | Тимлиды секций |
| `ws_task_actual_hours` | Фактические часы |
| `ws_task_budget_checkpoints` | Последний пройденный чекпоинт |
| `ws_task_percent_snapshots` | Снапшоты меток (вчера vs сегодня) |
| `ws_daily_reports` | Наличие записей времени |

---

## Порядок реализации

1. **Миграция БД** — создать таблицу `alarms` + RLS + UPDATE policy
2. **VPS-скрипт** — `generate-alarms.ts` + интеграция в orchestrator
3. **Бэкенд модуль** — `src/modules/alarms/` (queries, actions, types)
4. **UI** — `AlarmsBanner` компонент с чекбоксом и ссылками
5. **Интеграция** — подключить на дашборд, убрать старый AlertsBanner
6. **Документация** — `src/docs/alarms.md`

---

## Ограничения

- Алармы рассчитываются 1 раз в сутки (по расписанию VPS)
- `no_timetracking` — постфактум (красный день уже случился), но информирует юзера
- `label_change_soon` — предупреждение, не гарантия (метку можно сменить до следующего прогона)
- Решённый аларм (`is_resolved = true`) не удаляется при следующем прогоне — остаётся в истории
- Алармы не генерируют монеты/события — это чисто информационная система

---

## Решённые вопросы

1. **История алармов** — хранится. Решённые алармы не удаляются при пересчёте. Полезно для аналитики.
2. **Видимость** — ответственный за L2 видит team_* алармы о дочерних L3. Все алармы адресованы конкретному user_id на этапе генерации.
3. **Стрик-алармы** — не нужны в текущей версии.

## Тексты алармов (хардкод в скрипте)

| Тип | Title | Description |
|-----|-------|-------------|
| `label_change_soon` | Пора сменить метку прогресса | Задача «{task_name}» — бюджет {budget_percent}%, следующий чекпоинт {next_checkpoint}%. Смените метку, чтобы избежать нарушения |
| `team_label_change_soon` | Метка в секции требует смены | Задача «{task_name}» ({assignee_name}) — бюджет {budget_percent}%, чекпоинт {next_checkpoint}% |
| `team_label_changed` | Метка задачи обновлена | {changed_by_name} сменил метку «{task_name}»: {previous_label}% → {new_label}% |
| `no_timetracking` | Не списаны часы | Нет записей о рабочем времени за {missing_date} |
| `section_violation` | Нарушение динамики в секции | {violating_user_name} не сменил метку «{task_name}» при прохождении чекпоинта {checkpoint_crossed}% |
