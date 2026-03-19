# WS Grid — Грид дней и стрики на дашборде

## Цель

Подключить `StreakPanel` к реальным данным из Supabase: грид зелёных/красных дней за индивидуальный 90-дневный цикл пользователя, стрики WS и Revit под гридом. Убрать моковые данные.

## Скоуп

- Грид дней (индивидуальный 90-дневный цикл)
- Два стрика под гридом: Worksection + Автоматизации (Revit)
- Легенда
- **Вне скоупа:** ежедневные задания (DailyQuests), алерты, транзакции

## Источники данных

### Грид дней

| Источник | Что даёт |
|---|---|
| `view_daily_statuses` | Статус дня: `green` / `red` / `absent` + `absence_type` + `red_reasons` |
| `elk_plugin_launches` | Факт использования автоматизации (звезда ★ на ячейке) |

**Маппинг статусов БД → UI:**

| view_daily_statuses.status | absence_type | UI статус | Цвет | Тултип |
|---|---|---|---|---|
| `green` | — | `green` | зелёный | "Зелёный день" |
| `red` | — | `red` | красный | "Штраф" + red_reasons |
| `absent` | `vacation` | `frozen` | голубой | "Отпуск" |
| `absent` | `sick_leave` | `frozen` | голубой | "Больничный" |
| `absent` | `sick_day` | `frozen` | голубой | "Оплачиваемый больничный" |
| (нет записи, рабочий день, в прошлом) | — | `no_data` | серый + пунктир | "Нет данных" |
| (выходной) | — | `gray` | серый | "Выходной" |
| (будущий день) | — | `future` | прозрачный + пунктир | "Ещё не наступил" |
| (за пределами периода) | — | `out` | прозрачный | — |

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

## Индивидуальный 90-дневный цикл (замена календарных кварталов)

Вместо фиксированных календарных кварталов (Q1–Q4) используется **индивидуальный 90-дневный период** для каждого пользователя.

### Ключевые правила

- **Длина цикла:** 90 календарных дней от `streak_start_date`.
- **Milestones считают календарные дни**, не рабочие. Стрик 30 = 30 календарных дней от старта.
- **Старт цикла (`streak_start_date`):** дата первого зелёного дня после последнего сброса.
- **Конец цикла (`cycle_end`):** `streak_start_date` + 89 дней (всего 90 дней). Дата конца видна пользователю.

### Отображение грида

- **`grid_start`** = понедельник недели, в которую попадает `streak_start_date`. Нужен только для выравнивания — грид всегда начинается с понедельника.
- **`grid_end`** = воскресенье недели, в которую попадает `cycle_end`. Грид всегда заканчивается воскресеньем.
- Дни между `grid_start` и `streak_start_date` — статус `out` (padding до понедельника).
- Дни между `cycle_end` и `grid_end` — статус `out` (padding до воскресенья).
- Итого грид может быть чуть длиннее 90 дней за счёт padding-дней по краям.

**Пример:** `streak_start_date` = пятница 7 марта.
- `cycle_end` = 4 июня (пятница 7 марта + 89 дней).
- `grid_start` = понедельник 3 марта (padding: Пн–Чт = `out`).
- `grid_end` = воскресенье 8 июня (padding: Сб–Вс = `out`).

### Сброс цикла

Цикл сбрасывается в двух случаях:

1. **Красный день** → стрик = 0, `streak_start_date = NULL`. Новый цикл начнётся с первого зелёного дня после красного.
2. **Достижение 90 дней** → `completed_cycles += 1`, стрик = 0, `streak_start_date = NULL`, бонус +300 начислен. Новый цикл начинается аналогично.

### Состояние «стрик = 0, нет зелёного дня»

Если стрик сброшен и новый зелёный день ещё не наступил:
- `streak_start_date = NULL`, поэтому `grid_start` = понедельник текущей недели, `cycle_end` = `grid_start` + 89 дней, `grid_end` = воскресенье недели `cycle_end`.
- Все будущие дни — `future`, прошедшие без статуса — `no_data`.

### Определение `streak_start_date`

Хранится в `ws_user_streaks.streak_start_date`. Из неё вычисляется:
- `grid_start` = понедельник недели `streak_start_date` (или текущей недели если NULL)
- `cycle_end` = `streak_start_date` + 89 дней (или `grid_start` + 89 дней если NULL)
- `grid_end` = воскресенье недели `cycle_end`

---

## Изменения в схеме БД

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

**Файл:** `D:\1work\gamification-vps-scripts\src\scripts\compute-gamification.ts`, функция `updateStreaks` (строки 259–319)

---

## Этапы реализации

### Этап 0: Миграция БД

**Файлы:**
- Создать `supabase/migrations/0XX_add_ws_streak_cycle_columns.sql`

Добавить колонки `streak_start_date` и `completed_cycles` в `ws_user_streaks`.

### Этап 0.5: VPS-скрипт `compute-gamification`

**Файлы:**
- Изменить `D:\1work\gamification-vps-scripts\src\scripts\compute-gamification.ts`

**Изменения в функции `updateStreaks` (строки 259–319):**

1. Читать из БД расширенную строку: `current_streak`, `longest_streak`, `streak_start_date`, `completed_cycles`
2. Заменить инкремент `streak.current_streak += 1` на подсчёт календарных дней:
   - Если `streak_start_date` = NULL (новый стрик) → `streak_start_date = yesterdayIso`, `current_streak = 1`
   - Если `streak_start_date` != NULL → `current_streak = diffCalendarDays(streak_start_date, yesterdayIso) + 1`
3. После пересчёта проверить milestone 90:
   - `current_streak >= 90` → `completed_cycles += 1`, `current_streak = 0`, `streak_start_date = NULL`, создать событие `ws_streak_90`
4. При красном дне: `current_streak = 0`, `streak_start_date = NULL`
5. Обновлять upsert с новыми полями: `streak_start_date`, `completed_cycles`

### Этап 1: Серверные запросы (queries)

**Файлы:**
- Создать `src/modules/streak-panel/queries.ts`
- Создать `src/modules/streak-panel/types.ts`
- Создать `src/modules/streak-panel/index.ts`

**queries.ts — три запроса:**

1. `getStreakDayStatuses(userId, gridStart, gridEnd)` — из `view_daily_statuses` за период 90-дневного цикла. Возвращает массив `{ date, status, absence_type, red_reasons }`.

2. `getAutomationDays(userEmail, gridStart, gridEnd)` — из `elk_plugin_launches` за период. Возвращает `Set<string>` дат, когда была автоматизация.

3. `getStreakData(userId)` — из `ws_user_streaks` + `revit_user_streaks` + `gamification_event_types` (для наград milestones). Возвращает `{ ws: { currentStreak, streakStartDate, completedCycles, milestones[] }, revit: { currentStreak, milestones[] } }`.

**types.ts:**
- `DayStatusRow` — строка из `view_daily_statuses`
- `StreakPanelData` — объединённые данные для компонента
- `CalendarDay` — день для грида (заменяет `WorksectionDay` из data.ts)

### Этап 2: Сборка данных на сервере (page.tsx)

**Файлы:**
- Изменить `src/app/(main)/page.tsx` — заменить моковые данные вызовами queries

**Логика:**
1. Получить `streakData` (включая `streakStartDate`, `completedCycles`)
2. Вычислить `gridStart`, `cycleEnd`, `gridEnd`:
   - Если `streakStartDate` есть → `cycleEnd` = `streakStartDate` + 89 дней
   - Если `streakStartDate` = NULL → `cycleEnd` = понедельник текущей недели + 89 дней
   - `gridStart` = понедельник недели `streakStartDate` (или текущей недели)
   - `gridEnd` = воскресенье недели `cycleEnd`
3. Вызвать запросы статусов и автоматизации параллельно (`Promise.all`)
4. Собрать `calendarDays[]` — для каждого дня от `gridStart` до `gridEnd`:
   - За пределами цикла (до `streakStartDate` или после `cycleEnd`) → `out`
   - Выходной → `gray`
   - Будущий → `future`
   - Есть в view_daily_statuses → маппинг по таблице выше
   - Рабочий день в прошлом, нет записи → `no_data`
   - Автоматизация: проверить наличие даты в `Set` из `elk_plugin_launches`
5. Передать данные + `cycleEnd` + `completedCycles` в `StreakPanel` через props

### Этап 3: Обновление StreakPanel

**Файлы:**
- Изменить `src/components/dashboard/StreakPanel.tsx`
- Изменить `src/lib/data.ts` — удалить неиспользуемые моковые данные

**Изменения в типах:**
- Добавить `no_data` в `WorksectionDayStatus`
- Добавить `absenceType` в `WorksectionDay` (для тултипа)
- Добавить `redReasons` в `WorksectionDay` (для тултипа)

**Изменения в компоненте:**
- Показывать дату конца цикла (`cycleEnd`) в header
- Показывать количество завершённых циклов (`completedCycles`) — сколько раз пользователь прошёл 90 дней
- Новый цвет и стиль для `no_data`: серый + пунктирная рамка
- Тултипы с учётом `absenceType` и `redReasons`
- Переименовать label стрика: "Дисциплина WS" → "Worksection"
- Убрать зависимость от моковых данных

### Этап 4: Документация

**Файлы:**
- Создать `src/docs/streak-panel.md`

---

## Критерии готовности

- [ ] Грид показывает 90 календарных дней индивидуального цикла пользователя
- [ ] Грид начинается с понедельника недели старта стрика
- [ ] При стрике = 0 грид начинается с текущей недели
- [ ] При достижении 90 дней стрик сбрасывается, `completed_cycles` инкрементируется, начинается новый цикл
- [ ] Количество завершённых циклов отображается в компоненте
- [ ] При красном дне стрик сбрасывается, грид сдвигается при появлении нового зелёного дня
- [ ] Дата конца цикла видна пользователю
- [ ] Грид показывает реальные зелёные/красные/frozen дни из `view_daily_statuses`
- [ ] Звёзды автоматизации берутся из `elk_plugin_launches`
- [ ] Дни без данных отображаются серым с пунктирной рамкой
- [ ] Отпуск/больничный/сикдей — голубой цвет, тип виден в тултипе
- [ ] Стрик WS берётся из `ws_user_streaks`, milestones из `gamification_event_types`
- [ ] Стрик Revit берётся из `revit_user_streaks`, milestones из `gamification_event_types`
- [ ] Label "Дисциплина WS" заменён на "Worksection"
- [ ] Моковые данные стриков удалены из `data.ts`
- [ ] Миграция добавляет `streak_start_date` и `completed_cycles` в `ws_user_streaks`
- [ ] `npm run build` проходит
- [ ] Документация `src/docs/streak-panel.md` создана
