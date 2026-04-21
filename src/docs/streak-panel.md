# streak-panel

Модуль данных для панели стриков и грида дней на дашборде.

## Логика работы

Грид показывает 4 календарных месяца по двухмесячным блокам (Мар–Апр → Фев–Май, Май–Июн → Апр–Июл). Диапазон сдвигается каждые 2 месяца, одинаковый для всех пользователей.

Статусы дней определяются из таблицы `ws_daily_statuses`: green/red/absent → green/red/frozen. Рабочий день без записи → `no_data` (скрипт ещё не обработал). Выходные → `gray`. Будущие → `future`. Звёзды автоматизации — из `elk_plugin_launches`. Звёзды показываются на любых ячейках (включая `no_data`), на `no_data` — со stroke-контуром.

Выходные/праздники/переносы: Сб/Вс → `gray` по умолчанию. Даты из `calendar_holidays` → `gray` (праздник = выходной). Даты из `calendar_workdays` → рабочий день (перенос, суббота = рабочая). Приоритет: `calendar_workdays` перекрывает выходной, `calendar_holidays` перекрывает будний.

В шапке панели — два процентных показателя за текущий период: % зелёных дней из рабочих и % дней с автоматизациями из рабочих. Заменяют прежний счётчик «дней подряд».

Рядом с заголовком панели — info-кнопка с тултипом, в котором перечислены критерии зелёного дня (внесён отчёт; % готовности обновляется при пересечении чекпоинтов 20/40/60/80/100% бюджета задачи; время вносится в задачи со статусом «В работе») и те же условия в негативе для штрафа. «Процент готовности» и «метка готовности» — одно и то же поле `ws_tasks_l3.percent`.

Под гридом — два стрика: Worksection (из `ws_user_streaks`) и Автоматизации (из `revit_user_streaks`). Milestones отображаются inline рядом с лейблом стрика. Данные milestones берутся из `gamification_event_types`.

На дашборде StreakPanel и MasterPlannerPanel располагаются рядом в flex-контейнере (не вложены друг в друга). MasterPlannerPanel — отдельный модуль (см. `src/docs/master-planner.md`).

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

- `RedReason` — причина красного дня (jsonb из `ws_daily_statuses.red_reasons`): `{ type, ws_task_id?, ws_task_name?, ws_project_id?, ws_l2_id?, ws_task_url?, task_status? }`
- `CalendarDayStatus` — union: green | red | gray | frozen | future | out | no_data
- `CalendarDay` — день грида: date, status, automation, absenceType?, redReasons? (RedReason[])
- `StreakPanelData` — все данные для компонента: calendarDays, completedCycles, ws, revit

## Tooltip красных дней

При наведении на красную ячейку показываются человеко-читаемые причины:
- `red_day` → «Не внесён отчёт»
- `task_dynamics_violation` → «В задаче «{имя}» не был вовремя сменён процент готовности» + ссылка на WS
- `section_red` → «В задаче «{имя}» не была вовремя сменена метка готовности» + ссылка на WS
- `wrong_status_report` → «Время внесено в задачу «{имя}» (статус: {статус})» + ссылка на WS

Ссылки строятся: приоритетно из `ws_task_url` (прямая ссылка), иначе по формату `https://eneca.worksection.com/project/{projectId}/{l2Id}/{taskId}/`

Текущий день выделяется рамкой (`2px solid var(--apex-primary)`).

## Queries

- `getStreakDayStatuses(userId, gridStart, gridEnd)` — строки из ws_daily_statuses за период
- `getAutomationDays(userEmail, gridStart, gridEnd)` — Set дат из elk_plugin_launches
- `getWsStreakData(userId)` — стрик WS + milestones из gamification_event_types
- `getHolidays(gridStart, gridEnd)` — Set дат из calendar_holidays
- `getWorkdays(gridStart, gridEnd)` — Set дат из calendar_workdays
- `getRevitStreakData(userId)` — стрик Revit + milestones

## Ограничения

- Стрик считается в календарных днях минус дни отсутствий: `calendar_days - absence_days`. Выходные и праздники увеличивают стрик, отсутствия — замораживают
- Максимальная длина цикла — 90 дней, после чего сброс и completed_cycles += 1
- Отсутствие (отпуск/больничный) замораживает стрик, не сбрасывает
- Красный день ставит стрик в pending (24ч grace period). Если щит не куплен — сброс при следующем прогоне скрипта. См. `src/docs/streak-shield.md`
- VPS-скрипт пропускает Сб/Вс (кроме дат из `calendar_workdays`) и праздники из `calendar_holidays`
