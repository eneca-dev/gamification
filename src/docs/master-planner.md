# master-planner

Мастер планирования — механика стриков по задачам, закрытым в рамках бюджета. Два независимых стрика: L3 (исполнитель) и L2 (руководитель).

## Логика работы

10 последовательных задач, закрытых в рамках бюджета → бонус. Серия циклическая: каждые 10 → бонус заново. Превышение бюджета (`budget_exceeded`) сбрасывает серию в 0. Отзыв задачи (`budget_revoked`) убирает задачу из потока, стрик уменьшается.

Скрипт `compute-gamification.ts` (step 5) каждый прогон делает полный пересчёт (алгоритм A2): фильтрует revoked задачи из потока, считает стрики, сравнивает expected vs given бонусы, создаёт/отзывает по разнице. Результат записывается в `master_planner_state`.

## Зависимости

- Таблицы: `gamification_event_logs`, `gamification_transactions`, `master_planner_state`, `budget_pending`
- Вью: `view_master_planner_history` (обогащает события данными задач), `view_budget_pending_status` (pending-секция)
- Таблицы задач: `ws_tasks_l3`, `ws_tasks_l2`
- Скрипт: `compute-gamification.ts` (VPS)

## Типы

- `MasterPlannerPanelData` — данные для панели на дашборде (стрики L3/L2, последние события, pending)
- `MasterPlannerEvent` — событие для списка/истории
- `PendingBudgetTask` — задача, ожидающая проверки бюджета (level, taskName, taskUrl, daysRemaining)
- `MasterPlannerHistoryData` — данные для страницы истории (события, totalCount, startPosition)
- `HistoryStatusFilter` — union: 'ok' | 'exceeded' | 'revoked'

## Queries

- `getMasterPlannerPanel(userId)` — стрики из `master_planner_state`, последние 5 событий из вью, pending из `view_budget_pending_status`
- `getMasterPlannerHistory(userId, page, level?, status?)` — серверная пагинация по вью + доп. запрос для startPosition. Фильтры статуса: ok, exceeded, revoked (`HistoryStatusFilter`)
- `getAllPendingTasks(userId, level?)` — все pending-задачи из `view_budget_pending_status`, сортировка по eligible_date. Используется на странице истории при фильтре status=pending

## Ограничения

- Стрики L3 и L2 полностью независимы
- `budget_exceeded` сбрасывает серию в 0 (события `master_planner_reset` создаются скриптом, но не включены во вью — для UI достаточно `budget_exceeded`)
- `budget_revoked` убирает задачу из потока, может привести к `master_planner_revoked` (списание бонуса через coins_override)
- Revoke НЕ создаёт reset
- Coins при revoke берутся из оригинальной транзакции (coins_override), не из справочника
- Названия задач денормализованы в details событий мастера (tasks, exceeded_task, revoked_tasks)
- Streak position для страницы истории вычисляется через доп. запрос (startPosition) + нумерацию на клиенте
- Страница истории: два ряда фильтров (уровень L3/L2 + статус). Фильтр status=pending показывает таблицу pending-задач вместо истории событий
- На панели дашборда pending-секция показывает max 3 задачи, ссылка «+N ещё» ведёт на `/master-planner?status=pending`
- События `master_planner_reset` исключены из UI (не обрабатываются в EventIcon, eventLabel, getEventStyle, computePositions) — для отображения сброса достаточно `budget_exceeded`
- Бонусные строки (`master_planner`/`master_planner_l2` и revoked-варианты) разворачиваются по клику в список задач (`milestoneTasks`/`revokedTasks`); URL для каждой задачи строится в queries.ts через `buildBonusTaskUrlMaps` (lookup в `ws_tasks_l3`/`ws_tasks_l2` по level события). На странице может быть раскрыто несколько строк одновременно
- `buildBonusTaskUrlMaps` ходит в БД через admin client: на `ws_tasks_l3`/`ws_tasks_l2` включён RLS только для service_role, поэтому user-сессионный клиент вернул бы 0 строк и URL остались бы null. View `view_master_planner_history` работает через SECURITY DEFINER, поэтому остальные read-flow затронуты не были
- Revoke-события (`budget_revoked_l3`, `budget_revoked_l2`, `deadline_revoked_l3`) хранят `ws_task_id` в `details.original_details.ws_task_id`, поэтому view `view_master_planner_history` использует COALESCE с веткой `details->'original_details'->>'ws_task_id'` (миграция 046) — иначе у revoke-строк не было ссылки на задачу
- Bonus-revoke (`master_planner_revoked`, `master_planner_l2_revoked`):
  - **обычный revoke** хранит реальных виновников в `details.revoked_tasks` (обычно 1 задача с превышенным бюджетом). UI показывает их в раскрытии — зачёркнуто, красным.
  - **bulk-amnesty** (`details.amnesty = true`, текущие события 22.04.2026) хранит всю серию в `details.original_details.tasks` — но все 10 задач были revoked одновременно в одной транзакции, единого «виновника» не существует. Поэтому в `revoked_tasks` view возвращает только `details.revoked_tasks` (для амнистии — null), и UI просто не показывает раскрытие. Это честнее, чем подсовывать ложного виновника. Колонка `is_amnesty` в view осталась после экспериментов (миграция 049), но UI её не использует
