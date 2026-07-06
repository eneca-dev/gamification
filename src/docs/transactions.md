# transactions

Страница истории операций пользователя с фильтрацией по источнику и датам.

## Логика работы

Данные читаются из `view_user_transactions`. Фильтрация — по `source` и диапазону `event_date`. Пагинация: 30 записей на страницу. Параметры фильтра хранятся в URL (`source`, `date_from`, `date_to`, `sort`, `page`).

Сумма монет по фильтру (`getUserTransactionsSum`) считается по всем записям фильтра, а не только по текущей странице — чтобы пользователь видел реальный итог, который может быть отрицательным (например, штрафы `wrong_status_report` превышают зелёные дни за WS).

Фильтр `achievements` на клиенте включает source `achievements` и `contest` — оба отображаются под одной кнопкой.

Метаданные под описанием (виджет дашборда и страница операций, единый рендер через `@/components/transactions/TransactionMeta`):
- `revit_using_plugins` — список плагинов с числом запусков (`details.plugins`, поле `plugins`)
- благодарности (`gratitude_recipient_points`, `gratitude_gift_sent`) — категория (emoji + подпись из `@/lib/gratitude-categories`) и тип: квота при `details.gift_source === 'quota'`, иначе подарок (поле `gratitude`, хелпер `getGratitudeMeta`). «Спасибо» не создаёт транзакций (0 монет), поэтому в операциях не встречается

## Зависимости

- `view_user_transactions` — основной источник данных
- `ws_daily_statuses` — причины красного дня (red_reasons) для `red_day` событий
- `ws_tasks_l3`, `ws_tasks_l2` — ссылки на задачи для budget/deadline событий
- `shop_products` — emoji/image_url для событий покупок
- `ws_users` — имена отправителей/получателей благодарностей

## Source-значения

| source в БД | Лейбл в UI | Фильтр |
|---|---|---|
| `ws` | Worksection | `source=ws` |
| `revit` | Revit | `source=revit` |
| `gratitudes` | Благодарности | `source=gratitudes` |
| `achievements` | Достижения | `source=achievements` (включает contest) |
| `contest` | Соревнование | входит в `source=achievements` |
| `shop` | Магазин | `source=shop` |

## Queries

- `getUserTransactions(email, limit, offset, filters)` — список транзакций с обогащением (описание, ссылки на задачи, имена). Кэш-тег `transactions:{email}`, TTL 5 мин
- `getUserTransactionsCount(email, filters)` — общее число записей по фильтру (для пагинации)
- `getUserTransactionsSum(email, filters)` — сумма монет по всем записям фильтра (не только текущей страницы). Может быть отрицательной. Отображается бейджем в заголовке страницы: зелёный при ≥ 0, красный при < 0
- `getDashboardTransactions(email, limit)` — последние операции в формате отображения (`Transaction` из lib/data) для виджета дашборда. Без server-cache — данные тянет live-фид через realtime-инвалидацию
- `fetchDashboardTransactions(email, limit)` (actions.client) — обёртка для TanStack Query, сверяет email с текущей сессией, чужие операции не отдаёт

## Realtime

Таблица `gamification_transactions` в publication `supabase_realtime` (миграция 084). RLS-политика SELECT для authenticated отдаёт только свои строки (`user_id = my_ws_user_id()`), поэтому событие INSERT приходит только владельцу транзакции. Подписка в `@/modules/cache` инвалидирует `transactions.*` и `balance.*`. Fallback — `refetchOnWindowFocus` у `useRecentTransactions`.

## Компоненты

- `TransactionsList` — таблица операций. Поддерживает раскрытие задач master_planner. Source-тег с иконкой и цветом по `SOURCE_CONFIG`. Строки плагинов/благодарностей — через `PluginUsageLine` / `GratitudeMetaLine`
- `@/components/transactions/TransactionMeta` — общие строки метаданных (`PluginUsageLine`, `GratitudeMetaLine`), переиспользуются виджетом и страницей
- `TransactionsFilters` — кнопки-пилюли по source + DateRangePicker
- `SortToggle` — переключатель сортировки по дате (asc/desc)
- `LiveTransactionFeed` — live-обёртка над `TransactionFeed` (дашборд): серверный initialData + `useRecentTransactions`

## Страница

- `/transactions` — Server Component, все параметры из `searchParams`. Кнопка суммы в заголовке рядом со счётчиком операций

## Ограничения

- Обогащение транзакций (ссылки на задачи, имена) выполняется в `_getUserTransactions` через дополнительные запросы — не в view
- Для `red_day` event_date в БД сдвинут на +1 день триггером `trg_fix_ws_event_date`, поэтому `red_reasons` ищутся по `event_date - 1`
- Сумма по фильтру может быть отрицательной — это валидное состояние, не ошибка
