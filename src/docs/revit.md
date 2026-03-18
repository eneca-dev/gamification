# revit

Модуль автоматизации Revit: грид активности, стрики, лидерборд, транзакции, соревнование отделов.

## Логика работы

Данные поступают из Elasticsearch через Edge Function `sync-plugin-launches` → записываются в `elk_plugin_launches` (сырые запуски по плагинам).
Триггер `trg_award_revit_points` создаёт записи в `gamification_event_logs` + `gamification_transactions` и обновляет `revit_user_streaks`.
Фронт читает `elk_plugin_launches` для грида/лидерборда, `revit_user_streaks` для стриков, `view_user_transactions` для ленты операций.

## Зависимости

- `elk_plugin_launches` — сырые запуски плагинов (user_email, work_date, plugin_name, launch_count). RLS: authenticated SELECT.
- `revit_user_streaks` — стрики (current_streak, best_streak, last_green_date, is_frozen). FK → ws_users.id.
- `view_user_transactions` — view для ленты операций (coins, event_type, description, details). Нужен adminClient.
- `ws_users` — имена, email, department_code для лидерборда и соревнования.
- `gamification_event_types` — справочник: revit_using_plugins=5, revit_streak_7_bonus=25, revit_streak_30_bonus=100.

## Типы

- `RevitStreak` — current/best стрик, last_green_date, is_frozen
- `AutomationLeaderboardEntry` — email, fullName, launchCount, isCurrentUser
- `RevitYesterdaySummary` — pluginCount, coinsEarned (за вчера, из БД)
- `RevitTransaction` — eventType, eventDate, coins, description, pluginName, launchCount, createdAt
- `DepartmentAutomationEntry` — departmentCode, employeesUsing, totalEmployees, usagePercent, isCurrentDepartment
- `RevitWidgetData` — агрегат: streak + activeDates + yesterdaySummary

## Queries

- `getRevitActiveDates(email, days=98)` — уникальные даты из elk_plugin_launches для звёздочек на гриде
- `getRevitStreak(email)` — стрик из revit_user_streaks через ws_users.email
- `getTopAutomationUsers(limit, currentEmail?)` — топ N по SUM(launch_count) за 30 дней
- `getYesterdayRevitSummary(email)` — pluginCount из elk_plugin_launches + coinsEarned из view_user_transactions за вчера
- `getRevitTransactions(email, limit=10)` — последние транзакции source='revit' из view_user_transactions
- `getDepartmentAutomationStats(currentEmail?)` — % использующих плагины по department_code за 30 дней
- `getRevitWidgetData(email)` — агрегат (вызывает 3 query выше параллельно)

## Ограничения

- Данные в elk_plugin_launches синхронизируются раз в сутки за вчерашний день — сегодняшних данных нет
- Стрик обновляется триггером при синке elk_plugin_launches
- Ежедневное задание показывает статус за ВЧЕРА (т.к. синк ещё не прошёл за сегодня)
- view_user_transactions требует adminClient из-за RLS на gamification_event_logs
