# streak-panel

Модуль данных для панели стриков и грида дней на дашборде.

## Логика работы

Грид показывает 4 календарных месяца по двухмесячным блокам (Мар–Апр → Фев–Май, Май–Июн → Апр–Июл). Диапазон сдвигается каждые 2 месяца, одинаковый для всех пользователей.

Статусы дней определяются из таблицы `ws_daily_statuses`: green/red/absent → green/red/frozen. Рабочий день без записи → `no_data` (скрипт ещё не обработал). Выходные → `gray`. Будущие → `future`. Звёзды автоматизации — из `elk_plugin_launches`. Звёзды показываются на любых ячейках (включая `no_data`), на `no_data` — со stroke-контуром.

Выходные/праздники/переносы: Сб/Вс → `gray` по умолчанию. Даты из `calendar_holidays` → `gray` (праздник = выходной). Даты из `calendar_workdays` → рабочий день (перенос, суббота = рабочая). Приоритет: `calendar_workdays` перекрывает выходной, `calendar_holidays` перекрывает будний.

В шапке панели — два процентных показателя за текущий период: % зелёных дней из рабочих и % дней с автоматизациями из рабочих. Заменяют прежний счётчик «дней подряд».

Рядом с заголовком панели — info-кнопка с тултипом, в котором перечислены критерии зелёного дня (внесён отчёт; % готовности обновляется при пересечении каждого 20%-чекпоинта бюджета задачи, включая проверки в перерасход — 120%, 140% и далее; время вносится в задачи со статусом «В работе») и те же условия в негативе для штрафа. «Процент готовности» и «метка готовности» — одно и то же поле `ws_tasks_l3.percent`.

Под гридом — два стрика: Worksection (из view `ws_user_streaks_effective`) и Автоматизации (из view `revit_user_streaks_effective`). Milestones отображаются inline рядом с лейблом стрика. Данные milestones берутся из `gamification_event_types`.

WS-стрик считается на чтение через view. Модель: green=+1, отсутствие (отпуск/больничный/sick_day)=0 (заморозка), выходной/праздник=+1, red=триггерит pending. View walk'ает от `streak_start_date` (или от `pending_reset_date + 1`, если грейс истёк) до `fn_minsk_today() - 1`, применяя дельты по `ws_daily_statuses`. Во время активного грейса (`pending_reset_expires_at > now()`) view возвращает замороженное `ws_user_streaks.current_streak` (значение «до red»). После истечения грейса — пересчитывается с учётом выходных после red. Истечение происходит ровно в момент `expires_at`, без cron и vps-прогона.

На дашборде StreakPanel и MasterPlannerPanel располагаются рядом в flex-контейнере (не вложены друг в друга). MasterPlannerPanel — отдельный модуль (см. `src/docs/master-planner.md`).

## Зависимости

- `ws_daily_statuses` — статусы дней (заполняется VPS-скриптом compute-gamification)
- `elk_plugin_launches` — даты автоматизации
- `ws_user_streaks_effective` — view с актуальным `current_streak` на чтение (источник истины для UI)
- `ws_user_streaks` — таблица-снапшот: `streak_start_date`, `longest_streak`, `completed_cycles`, `pending_reset_date/expires_at`. Колонка `current_streak` в таблице — снапшот на момент vps-прогона (используется vps для milestone-сравнения «было/стало»), не источник для UI
- `revit_user_streaks_effective` — view с актуальным Revit-стриком (источник истины для UI). Считается так же, как WS-стрик, но walk идёт прямо по `elk_plugin_launches` (без таблицы per-day статусов)
- `revit_user_streaks` — таблица-снапшот для Revit: те же поля, что и у WS, плюс legacy `last_green_date`, `is_frozen`, `pending_gap_days`. Источник для milestone-сравнения в VPS-скрипте `compute-revit-gamification`
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

При наведении на красную ячейку показываются человеко-читаемые причины (дата в тултипе — в формате DD.MM.YYYY):
- `red_day` → «Не внесён отчёт»
- `task_dynamics_violation` → «В задаче «{имя}» не был вовремя сменён процент готовности» + ссылка на WS
- `section_red` → «В задаче «{имя}» не была вовремя сменена метка готовности» + ссылка на WS
- `wrong_status_report` → «Время внесено в задачу без статуса «В работе» — «{имя}» ({статус})» + ссылка на WS. Если `task_status` отсутствует — `(не установлен)`

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

- Стрик WS на чтение считается view'ом `ws_user_streaks_effective` по дельтам каждого календарного дня:
  - green → +1
  - отсутствие (отпуск/больничный/sick_day) → 0 (заморозка)
  - выходной/праздник (нет записи в `ws_daily_statuses`) → +1
  - red → 0 (защитный fallback; в норме не встречается в окне walk, т.к. при истечении грейса walk начинается с `pending_reset_date + 1`)
- Максимальная длина цикла — 90 дней, после чего сброс и completed_cycles += 1
- Отсутствие (отпуск/больничный) замораживает стрик, не сбрасывает
- Красный день ставит стрик в pending (24ч grace period). Во время грейса view возвращает замороженное значение из таблицы. После истечения грейса — пересчитанное с учётом выходных после red. Истечение происходит в момент `pending_reset_expires_at`, не зависит от прогона vps. См. `src/docs/streak-shield.md`
- VPS-скрипт пропускает Сб/Вс (кроме дат из `calendar_workdays`) и праздники из `calendar_holidays` — статусы за эти дни не пишутся в `ws_daily_statuses`, view трактует «нет записи» как +1
