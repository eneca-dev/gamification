# plugin-stats

Читает данные запусков плагинов из `elk_plugin_launches` и предоставляет статистику для UI: стрик автоматизаций и топ пользователей.

## Логика работы

Данные в `elk_plugin_launches` синхронизируются edge function `sync-plugin` из Kibana/Elasticsearch. Каждая строка — один пользователь за один рабочий день с суммарным количеством запусков.

**Стрик автоматизаций** берётся из таблицы `streaks` (тип `revit_green_days`), куда его записывает PostgreSQL-триггер `trg_award_revit_points` мгновенно при каждом синке `elk_plugin_launches`. Самостоятельное вычисление стрика в JS не используется — данные из `streaks` гарантированно консистентны с начислениями баллов.

**Топ пользователей** — агрегация `SUM(launch_count)` за последние 30 дней из `elk_plugin_launches`, JOIN с `ws_users` для получения имён.

## Зависимости

- `elk_plugin_launches` — сырые данные запусков (`user_email`, `work_date`, `launch_count`, `plugin_name`)
- `streaks` — стрики по типу `revit_green_days` (вычисляются триггером, не модулем)
- `ws_users` — имена и отделы сотрудников (вместо `auth.admin.listUsers()`)

## Типы

- `AutomationStreakData` — `{ currentDays, bestDays, lastGreenDate, activeDates[] }`
- `AutomationLeaderboardEntry` — `{ email, fullName, launchCount, isCurrentUser }`

## Queries

- `getUserAutomationStreak(email)` — стрик из `streaks` + активные даты из `elk_plugin_launches` за последние 98 дней
- `getTopAutomationUsers(limit, currentUserEmail?)` — топ N пользователей по запускам за 30 дней, JOIN с `ws_users`

## Ограничения

- Стрик в `streaks` обновляется триггером только при синке `elk_plugin_launches` — если синк не запускался, стрик не обновлялся
- Сегодняшний день не включается в стрик — данные синхронизируются только за прошедшие дни
- Если `elk_plugin_launches` пуста или запрос упал — возвращается пустой результат без ошибки
- Имена берутся из `ws_users.first_name + last_name`, не из `auth.admin.listUsers()` — если сотрудник не синкнут в `ws_users`, имя будет null
