# WS Grid — Грид дней и стрики на дашборде

## Цель

Подключить `StreakPanel` к реальным данным из Supabase: грид зелёных/красных дней за 4 календарных месяца, стрики WS и Revit под гридом. Убрать моковые данные.

## Скоуп

- Грид дней (4 месяца по двухмесячным блокам)
- Два стрика под гридом: Worksection + Автоматизации (Revit)
- Легенда
- Таблица `ws_daily_statuses` — source of truth для статусов дней
- **Вне скоупа:** ежедневные задания (DailyQuests), алерты, транзакции

## Источники данных

### Грид дней

| Источник | Что даёт |
|---|---|
| `ws_daily_statuses` | Статус дня: `green` / `red` / `absent` + `absence_type` + `red_reasons` |
| `elk_plugin_launches` | Факт использования автоматизации (звезда ★ на ячейке) |

**Маппинг статусов → UI:**

| ws_daily_statuses.status | absence_type | UI статус | Цвет | Тултип |
|---|---|---|---|---|
| `green` | — | `green` | зелёный | "Зелёный день" |
| `red` | — | `red` | красный | "Штраф" + red_reasons |
| `absent` | `vacation` | `frozen` | голубой | "Отпуск" |
| `absent` | `sick_leave` | `frozen` | голубой | "Больничный" |
| `absent` | `sick_day` | `frozen` | голубой | "Оплачиваемый больничный" |
| (нет записи, рабочий день, в прошлом) | — | `no_data` | серый + пунктир | "Нет данных (скрипт не обработал)" |
| (выходной) | — | `gray` | серый | "Выходной" |
| (будущий день) | — | `future` | прозрачный + пунктир | "Ещё не наступил" |
| (padding до Пн/после Вс) | — | `out` | прозрачный | — (только для выравнивания недель) |

### Стрик Worksection

| Источник | Что даёт |
|---|---|
| `ws_user_streaks` | `current_streak`, `longest_streak`, `streak_start_date`, `completed_cycles` |
| `gamification_event_types` | Награды за milestones: `ws_streak_7` (+25), `ws_streak_30` (+100), `ws_streak_90` (+300) |

Milestones: 7 / 30 / 90 **календарных** дней. Milestone считается reached, если `current_streak >= milestone.days`.

### Стрик Автоматизации (Revit)

| Источник | Что даёт |
|---|---|
| `revit_user_streaks` | `current_streak`, `best_streak`, `last_green_date` |
| `gamification_event_types` | Награды за milestones: `revit_streak_7_bonus` (+25), `revit_streak_30_bonus` (+100) |

Milestones: 7 / 30 дней.

## Отображение грида — двухмесячные блоки

Грид показывает **4 календарных месяца**. Диапазон сдвигается каждые 2 месяца.

### Логика блоков

Месяцы разбиты на пары: Янв–Фев, Мар–Апр, Май–Июн, Июл–Авг, Сен–Окт, Ноя–Дек.
Грид показывает: **предыдущая пара (2-й месяц) + текущая пара + следующая пара (1-й месяц)**.

| Текущий месяц | Показываем |
|---|---|
| Янв–Фев | Дек, Янв, Фев, Мар |
| Мар–Апр | Фев, Мар, Апр, Май |
| Май–Июн | Апр, Май, Июн, Июл |
| Июл–Авг | Июн, Июл, Авг, Сен |
| Сен–Окт | Авг, Сен, Окт, Ноя |
| Ноя–Дек | Окт, Ноя, Дек, Янв |

### Формула вычисления

```
startMonth = floor((currentMonth - 1) / 2) * 2  // 0-indexed: 0=Jan
rangeStart = 1-е число startMonth
rangeEnd   = последний день (startMonth + 3)
```

Примеры:
- Март (month=3): `floor(2/2)*2 = 2` → Фев (idx 1) — Май (idx 4) → 1 фев – 31 мая
- Апрель (month=4): `floor(3/2)*2 = 2` → Фев — Май → тот же диапазон
- Май (month=5): `floor(4/2)*2 = 4` → Апр (idx 3) — Июл (idx 6) → 1 апр – 31 июл

### Правила отображения

- Грид выравнивается по неделям (padding `null` до понедельника / после воскресенья)
- Диапазон **не зависит** от стрика или `streak_start_date` — одинаковый для всех пользователей
- При смене блока (например, с апреля на май) грид сдвигается на 2 месяца

## 90-дневный цикл стриков (бэкенд)

Цикл 90 дней сохраняется в бэкенде (`ws_user_streaks`), но **не влияет на границы грида**. Грид просто отображает статусы дней за 4 месяца.

### Ключевые правила цикла

- **Длина цикла:** 90 календарных дней от `streak_start_date`.
- **Milestones считают календарные дни**, не рабочие.
- **Старт цикла (`streak_start_date`):** дата первого зелёного дня после последнего сброса.
- Красный день → стрик = 0, `streak_start_date = NULL`.
- Достижение 90 дней → `completed_cycles += 1`, стрик = 0, `streak_start_date = NULL`, бонус +300.
- Отсутствие → стрик заморожен, `streak_start_date` не меняется.

---

## Изменения в схеме БД

### Новая таблица `ws_daily_statuses`

Source of truth для статусов дней. Заменяет `view_daily_statuses` как основной источник для грида.

```sql
CREATE TABLE ws_daily_statuses (
  user_id       uuid NOT NULL REFERENCES ws_users(id) ON DELETE CASCADE,
  date          date NOT NULL,
  status        text NOT NULL CHECK (status IN ('green', 'red', 'absent')),
  absence_type  text,           -- 'vacation', 'sick_leave', 'sick_day'
  red_reasons   text[],         -- ['red_day'], ['task_dynamics_violation'], etc.
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

CREATE INDEX idx_ws_daily_statuses_user_date
  ON ws_daily_statuses (user_id, date);
```

**Ключевые свойства:**
- Одна строка = один день одного пользователя
- Нет записи = скрипт ещё не обработал этот день → `no_data` в UI
- Есть запись `red` = скрипт обработал, отчёт не внесён → `red` в UI
- Идемпотентность: PK `(user_id, date)`, upsert при повторном запуске
- RLS: service role only

**Что происходит с `view_daily_statuses`:**
- View остаётся для обратной совместимости, но грид читает из `ws_daily_statuses`
- В будущем view можно заменить на SELECT из `ws_daily_statuses`

Миграция: `supabase/migrations/0XX_create_ws_daily_statuses.sql`

### Таблица `ws_user_streaks` — новые колонки

Текущая схема: `user_id`, `current_streak`, `longest_streak`, `updated_at`.

Добавить:

| Колонка | Тип | Default | Описание |
|---|---|---|---|
| `streak_start_date` | date | NULL | Дата первого зелёного дня текущего стрика. NULL при стрике = 0. Обнуляется при сбросе, заполняется при новом зелёном дне. |
| `completed_cycles` | integer | 0 | Счётчик завершённых 90-дневных стриков. Инкрементируется при достижении 90 дней. Не сбрасывается. |

Миграция: `supabase/migrations/0XX_add_ws_streak_cycle_columns.sql`

```sql
ALTER TABLE ws_user_streaks
  ADD COLUMN streak_start_date date,
  ADD COLUMN completed_cycles integer NOT NULL DEFAULT 0;
```

### Логика обновления (VPS-скрипт `compute-gamification`)

**Важно:** `current_streak` теперь хранит количество **календарных** дней, а не рабочих. Считается как разница между `streak_start_date` и текущей датой (+ 1).

При обработке нового дня (`yesterdayIso`):
- **Зелёный день, `streak_start_date` = NULL** → `streak_start_date = yesterdayIso`, `current_streak = 1`
- **Зелёный день, `streak_start_date` != NULL** → `current_streak = (yesterdayIso - streak_start_date) + 1` (календарных дней)
- **current_streak >= 90** → `completed_cycles += 1`, `current_streak = 0`, `streak_start_date = NULL`, начислить +300 коинов
- **Красный день** → `current_streak = 0`, `streak_start_date = NULL`
- **Отсутствие** → ничего не меняется (стрик заморожен, `streak_start_date` остаётся)

Milestones (7, 30, 90) проверяются по значению `current_streak` после пересчёта.

---

## Этапы реализации

### Этап 0: Миграции БД

**Файлы:**
- ✅ Создать `supabase/migrations/013_create_ws_daily_statuses.sql`
- ✅ Создать `supabase/migrations/011_add_ws_streak_cycle_columns_and_align_events.sql`

**Что делает:**
1. ✅ Создать таблицу `ws_daily_statuses` (user_id, date, status, absence_type, red_reasons, created_at) с PK (user_id, date)
2. ✅ Добавить колонки `streak_start_date` и `completed_cycles` в `ws_user_streaks`
3. ✅ RLS: включить, доступ только service role (для `ws_daily_statuses`)

### Этап 0.5: VPS-скрипт `compute-gamification`

**Файл:** `D:\1work\gamification-vps-scripts\src\scripts\compute-gamification.ts`

**Изменение 1 — ✅ запись в `ws_daily_statuses` (функция `computeDayStatus`):**

После определения статуса дня для каждого пользователя — upsert в `ws_daily_statuses`:

```ts
await supabase.from('ws_daily_statuses').upsert({
  user_id: user.id,
  date: yesterdayIso,
  status,                    // 'green' | 'red' | 'absent'
  absence_type: ...,         // из ws_user_absences или null
  red_reasons: ...,          // из events или null
}, { onConflict: 'user_id,date' })
```

Нужно собрать `absence_type` (из `ws_user_absences`) и `red_reasons` (из events текущего запуска) для каждого пользователя.

**Изменение 2 — стрики на календарных днях (функция `updateStreaks`):**

1. ✅ Читать из БД: `current_streak`, `longest_streak`, `streak_start_date`, `completed_cycles`
2. ✅ При зелёном дне:
   - ✅ Если `streak_start_date` = NULL → `streak_start_date = yesterdayIso`, `current_streak = 1`
   - ✅ Иначе → `current_streak = diffCalendarDays(streak_start_date, yesterdayIso) + 1`
3. ✅ Проверить milestone 90: `current_streak >= 90` → `completed_cycles += 1`, сброс, событие `ws_streak_90`
4. ✅ При красном дне: `current_streak = 0`, `streak_start_date = NULL`
5. ✅ Upsert с полями: `streak_start_date`, `completed_cycles`

### Этап 1: Серверные запросы (queries)

**Файлы:**
- ✅ Создать `src/modules/streak-panel/queries.ts`
- ✅ Создать `src/modules/streak-panel/types.ts`
- ✅ Создать `src/modules/streak-panel/index.ts`

**queries.ts — три запроса:**

1. ✅ `getDayStatuses(userId, rangeStart, rangeEnd)` — читает из `ws_daily_statuses`.

2. ✅ `getAutomationDays(userEmail, rangeStart, rangeEnd)` — из `elk_plugin_launches` за период. Возвращает `Set<string>` дат, когда была автоматизация.

3. ✅ `getStreakData(userId)` — из `ws_user_streaks` + `revit_user_streaks` + `gamification_event_types` (для наград milestones). Возвращает `{ ws: { currentStreak, streakStartDate, completedCycles, milestones[] }, revit: { currentStreak, milestones[] } }`.

**types.ts:**
- ✅ `DayStatusRow` — строка из view/таблицы
- ✅ `StreakPanelData` — объединённые данные для компонента
- ✅ `CalendarDay` — день для грида

### Этап 2: Сборка данных на сервере (page.tsx)

**Файлы:**
- ✅ Изменить `src/app/(main)/page.tsx` — заменить моковые данные вызовами queries

**Логика:**
1. ✅ Получить `streakData` (включая `streakStartDate`, `completedCycles`)
2. ✅ Вычислить `rangeStart` / `rangeEnd` по формуле двухмесячных блоков:
   ```
   startMonth = floor((currentMonth - 1) / 2) * 2  // 0-indexed
   rangeStart = 1-е число startMonth
   rangeEnd   = последний день (startMonth + 3)
   ```
3. ✅ Вызвать запросы статусов и автоматизации параллельно (`Promise.all`)
4. ✅ Собрать `calendarDays[]` — маппинг статусов, выходных, будущих, `no_data`, автоматизации
5. ✅ Передать данные + `completedCycles` в `StreakPanel` через props

### Этап 3: Обновление StreakPanel

**Файлы:**
- ✅ Изменить `src/components/dashboard/StreakPanel.tsx`
- ✅ Изменить `src/lib/data.ts` — удалить неиспользуемые моковые данные

**Изменения в типах:**
- ✅ Добавить `no_data` в `CalendarDayStatus`
- ✅ Добавить `absenceType` в `CalendarDay` (для тултипа)
- ✅ Добавить `redReasons` в `CalendarDay` (для тултипа)

**Изменения в компоненте:**
- ✅ Показывать количество завершённых циклов (`completedCycles`) — badge в header
- ✅ Новый цвет и стиль для `no_data`: серый + пунктирная рамка
- ✅ Тултипы с учётом `absenceType` и `redReasons`
- ✅ Переименовать label стрика: "Дисциплина WS" → "Worksection"
- ✅ Убрать зависимость от моковых данных

### Этап 4: Документация

**Файлы:**
- ✅ Создать `src/docs/streak-panel.md`

---

## Критерии готовности

### Миграции БД
- [x] Таблица `ws_daily_statuses` создана (миграция 013)
- [x] Колонки `streak_start_date` и `completed_cycles` добавлены в `ws_user_streaks`

### VPS-скрипт `compute-gamification`
- [x] Скрипт пишет в `ws_daily_statuses` (batch upsert из `computeDayStatus`)
- [x] `updateStreaks` считает календарные дни (`diffCalendarDays`)
- [x] `updateStreaks` использует `streak_start_date` (заполняет при новом стрике, обнуляет при сбросе)
- [x] `updateStreaks` инкрементирует `completed_cycles` при достижении 90 дней
- [x] `updateStreaks` upsert с полями `streak_start_date`, `completed_cycles`

### Грид и данные
- [x] `getStreakDayStatuses` читает из `ws_daily_statuses`
- [x] `no_data` чётко отличается от `red` (нет записи = скрипт не обработал, `red` = явная запись)
- [x] `getGridRange` считает по двухмесячным блокам
- [x] Грид показывает 4 месяца (функция `getGridRange` + `buildCalendarDays` в page.tsx)
- [x] Звёзды автоматизации берутся из `elk_plugin_launches` (`getAutomationDays`)
- [x] Дни без данных (`no_data`) поддерживаются в маппинге (`buildCalendarDays`)
- [x] Отпуск/больничный/сикдей → `frozen`, тип в тултипе (`absenceType`, `redReasons`)

### Модуль streak-panel
- [x] `src/modules/streak-panel/queries.ts` создан (4 запроса)
- [x] `src/modules/streak-panel/types.ts` создан
- [x] `src/modules/streak-panel/index.ts` создан

### Компонент StreakPanel
- [x] `no_data` статус в `statusColors`
- [x] `absenceType` и `redReasons` в CalendarDay
- [x] `completedCycles` badge в header
- [x] Label "Worksection" (вместо "Дисциплина WS")
- [x] Моковые данные стриков удалены из `data.ts`

### Документация
- [x] `src/docs/streak-panel.md` обновлена (view → таблица, двухмесячные блоки)
- [x] `src/docs/gamification-db.md` обновлена (ws_daily_statuses + deprecated view)

### Миграция с view
- [ ] Удалить `view_daily_statuses` (миграция DROP VIEW — после деплоя и проверки)

### Общее
- [x] `npm run build` проходит
