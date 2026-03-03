# plugin-stats

Читает данные запусков плагинов из Supabase (`plugin_launches`) и вычисляет стрик автоматизаций и топ пользователей.

## Логика работы

Данные в `plugin_launches` синхронизируются ежедневно в 01:00 UTC Edge Function `sync-plugin` из Kibana/Elasticsearch. Каждая строка — один пользователь за один рабочий день с суммарным количеством запусков всех плагинов.

Стрик автоматизаций считается как серия подряд идущих рабочих дней (пн–пт) начиная со вчера, где у пользователя есть хотя бы один запуск. Выходные пропускаются и не прерывают серию.

Топ пользователей — сумма `launch_count` за последние 30 дней, агрегированная в JS. Имена берутся из `auth.admin.listUsers()` через `user_metadata.full_name`.

## Зависимости

- Supabase table: `plugin_launches (user_email, work_date, launch_count)`
- `auth.admin.listUsers()` — для получения имён (требует service role key)
- `createSupabaseServerClient()` — для запросов от имени аутентифицированного пользователя
- `createSupabaseAdminClient()` — для запросов с обходом RLS

## Типы

- `AutomationStreakData` — `{ currentDays, activeDates[] }` — результат расчёта стрика
- `AutomationLeaderboardEntry` (в `src/lib/types.ts`) — `{ email, fullName, launchCount, isCurrentUser }` — строка топа

## Queries

- `getUserAutomationStreak(email)` — стрик и активные даты за последние 98 дней для одного пользователя
- `getTopAutomationUsers(limit, currentUserEmail?)` — топ N пользователей по запускам за 30 дней

## Ограничения

- Сегодняшний день не включается в стрик — данные синхронизируются только за вчера
- Если `plugin_launches` пуста или запрос упал — возвращается пустой результат без ошибки (fallback graceful)
- Лидерборд UI падает на моковые данные, если топ пользователей пустой (`topAutomationUsers.length === 0`)
