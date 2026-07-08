# revit

Модуль автоматизации Revit: грид активности, стрики, лидерборд, транзакции, соревнование отделов.

## Логика работы

Данные поступают из Elasticsearch через VPS-скрипт `sync-plugin-launches` (`gamification-vps-scripts/src/scripts/sync-plugin-launches.ts`) → записываются в `elk_plugin_launches` (сырые запуски по плагинам).

Триггер `trg_award_revit_points` (на INSERT в `elk_plugin_launches`) делает только два дела: идемпотентный лог в `gamification_event_logs` (с накоплением `details.plugins[]`) и начисление 5 💎 за первый плагин дня. **Стрики триггер не трогает.**

Стрик считается на чтение через view `revit_user_streaks_effective` (зеркало WS — миграция 040). VPS-скрипт `compute-revit-gamification` обновляет `revit_user_streaks` (snapshot для milestone-сравнения) и эмитит события milestones 7/30, `revit_streak_reset` при истечении grace pending.

Фронт читает `elk_plugin_launches` для грида/лидерборда, view `revit_user_streaks_effective` для стриков, `view_user_transactions` для ленты операций.

## Зависимости

- `elk_plugin_launches` — сырые запуски плагинов (user_email, work_date, plugin_name, launch_count). RLS: authenticated SELECT.
- `revit_user_streaks_effective` — view с актуальным `current_streak`/`best_streak` на чтение. Walk прямо по `elk_plugin_launches`, `ws_user_absences`, `calendar_*`. Источник истины для UI.
- `revit_user_streaks` — таблица-снапшот: `streak_start_date`, `best_streak`, `completed_cycles`, `pending_reset_date/expires_at`. Управляется VPS-скриптом, для UI не используется напрямую (кроме pending для streak-shield).
- `view_user_transactions` — view для ленты операций (coins, event_type, description, details). Нужен adminClient.
- `ws_users` — имена, email, department_code для лидерборда и соревнования.
- `gamification_event_types` — справочник: `revit_using_plugins=10`, `revit_streak_7_bonus=25`, `revit_streak_30_bonus=100`, `revit_streak_reset=0`.

## Типы

- `RevitStreak` — current_streak, best_streak (читается из view)
- `AutomationLeaderboardEntry` — email, fullName, launchCount, isCurrentUser
- `RevitYesterdaySummary` — pluginCount, coinsEarned (за вчера, из БД)
- `RevitTransaction` — eventType, eventDate, coins, description, pluginName, launchCount, createdAt
- `DepartmentAutomationEntry` — departmentCode, employeesUsing, totalEmployees, usagePercent, isCurrentDepartment
- `RevitWidgetData` — агрегат: streak + activeDates + yesterdaySummary

## Queries

- `getRevitActiveDates(email, days=98)` — уникальные даты из elk_plugin_launches для звёздочек на гриде
- `getRevitStreak(email)` — стрик из view `revit_user_streaks_effective` через ws_users.email
- `getTopAutomationUsers(limit, currentEmail?)` — топ N по SUM(launch_count) за 30 дней
- `getYesterdayRevitSummary(email)` — pluginCount из elk_plugin_launches + coinsEarned из view_user_transactions за вчера
- `getRevitTransactions(email, limit=10)` — последние транзакции source='revit' из view_user_transactions
- `getDepartmentAutomationStats(currentEmail?)` — % использующих плагины по department_code за 30 дней
- `getRevitWidgetData(email)` — агрегат (вызывает 3 query выше параллельно)

## Ограничения

- Данные в elk_plugin_launches синхронизируются раз в сутки за вчерашний день VPS-скриптом `sync-plugin-launches` — сегодняшних данных нет.
- Стрик считается view'ом по той же модели, что и WS: green=+1, выходной/праздник=+1, отсутствие=0 (заморозка), red=триггерит pending. Цикл — 30 дней.
- Pending grace 24h: во время грейса view возвращает замороженный `current_streak` из таблицы. После истечения — пересчитывается. Финализация просроченных pending — phase 1 в `compute-revit-gamification`.
- Ежедневное задание показывает статус за ВЧЕРА (т.к. синк ещё не прошёл за сегодня).
- view_user_transactions требует adminClient из-за RLS на gamification_event_logs.
- Колонки `last_green_date`, `is_frozen`, `pending_gap_days` в таблице `revit_user_streaks` — legacy от старого триггера, не используются (могут быть дропнуты отдельной миграцией).
