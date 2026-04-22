# План подключения БД к фронту

## Принципы

- Все запросы к БД — в Server Components через `queries.ts` модуля
- Никаких `fetch` из клиента к API routes без явной причины
- Клиент Supabase выбирается по уровню доступа таблицы:

| Таблица                              | RLS                  | Клиент                       |
| ------------------------------------ | -------------------- | ---------------------------- |
| `at_gratitudes`, `v_gratitudes_feed` | SELECT open          | `createSupabaseServerClient` |
| `revit_user_streaks`                 | authenticated SELECT | `createSupabaseAdminClient`  |
| `gamification_event_logs`            | service_role only    | `createSupabaseAdminClient`  |
| `ws_users`                           | service_role only    | `createSupabaseAdminClient`  |
| `profiles`                           | —                    | `createSupabaseServerClient` |

## Идентификация текущего пользователя

```
auth.users (Supabase Auth)
  ↓ user_id (uuid)
profiles.user_id  ←→  ws_users.user_id (trigger проставляет при регистрации)
                            ↓ ws_users.id (внутренний PK)
                       revit_user_streaks.user_id
                       ws_daily_reports.user_id
```

Для запросов используем:

- `user_email` — для `gamification_event_logs` (индексирован, надёжен)
- `ws_users.id` — для `revit_user_streaks`
- `profiles.user_id` — для `gamification_transactions`, `gamification_balances`

## Модули и их статус

| Модуль        | Таблицы / View                                                | Статус            |
| ------------- | ------------------------------------------------------------- | ----------------- |
| `gratitudes`  | `v_gratitudes_feed`                                           | ✅ queries готовы |
| `revit`       | `gamification_event_logs`, `revit_user_streaks`               | ✅ queries готовы |
| `ws`          | `ws_daily_reports`, `ws_user_absences`, `view_daily_statuses` | 🔜 не начат       |
| `balance`     | `gamification_balances`, `gamification_transactions`          | 🔜 не начат       |
| `leaderboard` | `gamification_balances` + `ws_users`                          | 🔜 не начат       |

## View-ы в БД

| View                  | Назначение                              | Статус                     |
| --------------------- | --------------------------------------- | -------------------------- |
| `v_gratitudes_feed`   | Фид благодарностей с именем отправителя | ✅ создана (migration 010) |
| `view_daily_statuses` | Грид WS дней (зелёный/красный)          | ✅ была ранее              |

## Очерёдность подключения к фронту

1. **Благодарности** — `getRecentGratitudes()` → виджет на главной
2. **Ревит виджет** — `getRevitWidgetData()` → грид + стрик + вчерашние 💎
3. **WS грид** — подключить `view_daily_statuses` (отдельная задача)
4. **Баланс** — `gamification_balances` для CoinBalance компонента
5. **Лидерборд** — топ по балансу

## Структура страницы (главная)

```
page.tsx (Server Component)
  ├── получает текущего юзера (auth session)
  ├── вызывает параллельно:
  │     getRecentGratitudes()
  │     getRevitWidgetData(email, wsUserId)
  └── передаёт data через props в Client Components
        ├── GratitudesFeed (отображение)
        └── RevitWidget (отображение)
```
