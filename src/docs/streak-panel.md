# streak-panel

Модуль данных для панели стриков и грида дней на дашборде.

## Логика работы

Грид показывает индивидуальный 90-дневный цикл пользователя. Цикл начинается с `streak_start_date` (первый зелёный день после сброса) и длится 90 календарных дней. Грид выравнивается по неделям: `grid_start` = понедельник недели `streak_start_date`, `grid_end` = воскресенье недели `cycle_end`. Дни за пределами цикла имеют статус `out`.

При `streak_start_date = NULL` (стрик сброшен, нет зелёного дня) грид начинается с понедельника текущей недели.

Статусы дней определяются из `view_daily_statuses`: green/red/absent → green/red/frozen. Рабочий день без записи → `no_data`. Выходные → `gray`. Будущие → `future`. Звёзды автоматизации — из `elk_plugin_launches`.

Под гридом — два стрика: Worksection (из `ws_user_streaks`) и Автоматизации (из `revit_user_streaks`). Milestones берутся из `gamification_event_types`.

## Зависимости

- `view_daily_statuses` — статусы дней
- `elk_plugin_launches` — даты автоматизации
- `ws_user_streaks` — стрик WS (current_streak, longest_streak, streak_start_date, completed_cycles)
- `revit_user_streaks` — стрик Revit (current_streak)
- `gamification_event_types` — награды milestones (ws_streak_7/30/90, revit_streak_7/30_bonus)
- `ws_users` — маппинг email → user_id

## Типы

- `CalendarDayStatus` — union: green | red | gray | frozen | future | out | no_data
- `CalendarDay` — день грида: date, status, automation, absenceType?, redReasons?
- `StreakPanelData` — все данные для компонента: calendarDays, cycleEnd, completedCycles, ws, revit

## Queries

- `getStreakDayStatuses(userId, gridStart, gridEnd)` — строки из view_daily_statuses за период
- `getAutomationDays(userEmail, gridStart, gridEnd)` — Set дат из elk_plugin_launches
- `getWsStreakData(userId)` — стрик WS + milestones из gamification_event_types
- `getRevitStreakData(userId)` — стрик Revit + milestones

## Ограничения

- Стрик считается в календарных днях, не рабочих
- Максимальная длина цикла — 90 дней, после чего сброс и completed_cycles += 1
- Отсутствие (отпуск/больничный) замораживает стрик, не сбрасывает
- Красный день сбрасывает стрик и streak_start_date
