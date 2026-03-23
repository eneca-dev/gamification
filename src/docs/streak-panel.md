# streak-panel

Модуль данных для панели стриков и грида дней на дашборде.

## Логика работы

Грид показывает 4 календарных месяца по двухмесячным блокам (Мар–Апр → Фев–Май, Май–Июн → Апр–Июл). Диапазон сдвигается каждые 2 месяца, одинаковый для всех пользователей.

Статусы дней определяются из таблицы `ws_daily_statuses`: green/red/absent → green/red/frozen. Рабочий день без записи → `no_data` (скрипт ещё не обработал). Выходные → `gray`. Будущие → `future`. Звёзды автоматизации — из `elk_plugin_launches`. Звёзды показываются на любых ячейках (включая `no_data`), на `no_data` — со stroke-контуром.

Выходные/праздники/переносы: Сб/Вс → `gray` по умолчанию. Даты из `calendar_holidays` → `gray` (праздник = выходной). Даты из `calendar_workdays` → рабочий день (перенос, суббота = рабочая). Приоритет: `calendar_workdays` перекрывает выходной, `calendar_holidays` перекрывает будний.

Под гридом — два стрика: Worksection (из `ws_user_streaks`) и Автоматизации (из `revit_user_streaks`). Milestones берутся из `gamification_event_types`.

## Зависимости

- `ws_daily_statuses` — статусы дней (заполняется VPS-скриптом compute-gamification)
- `elk_plugin_launches` — даты автоматизации
- `ws_user_streaks` — стрик WS (current_streak, longest_streak, streak_start_date, completed_cycles)
- `revit_user_streaks` — стрик Revit (current_streak)
- `gamification_event_types` — награды milestones (ws_streak_7/30/90, revit_streak_7/30_bonus)
- `calendar_holidays` — праздники/нерабочие дни (дата → gray в гриде, скрипт пропускает)
- `calendar_workdays` — рабочие переносы (выходной → рабочий день, скрипт обрабатывает)
- `ws_users` — маппинг email → user_id

## Типы

- `CalendarDayStatus` — union: green | red | gray | frozen | future | out | no_data
- `CalendarDay` — день грида: date, status, automation, absenceType?, redReasons?
- `StreakPanelData` — все данные для компонента: calendarDays, completedCycles, ws, revit

## Queries

- `getStreakDayStatuses(userId, gridStart, gridEnd)` — строки из ws_daily_statuses за период
- `getAutomationDays(userEmail, gridStart, gridEnd)` — Set дат из elk_plugin_launches
- `getWsStreakData(userId)` — стрик WS + milestones из gamification_event_types
- `getHolidays(gridStart, gridEnd)` — Set дат из calendar_holidays
- `getWorkdays(gridStart, gridEnd)` — Set дат из calendar_workdays
- `getRevitStreakData(userId)` — стрик Revit + milestones

## Ограничения

- Стрик считается в календарных днях, не рабочих
- Максимальная длина цикла — 90 дней, после чего сброс и completed_cycles += 1
- Отсутствие (отпуск/больничный) замораживает стрик, не сбрасывает
- Красный день сбрасывает стрик и streak_start_date
- VPS-скрипт пропускает Сб/Вс (кроме дат из `calendar_workdays`) и праздники из `calendar_holidays`
