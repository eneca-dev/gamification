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
