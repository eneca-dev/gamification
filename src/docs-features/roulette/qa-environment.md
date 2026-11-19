> Обновление 18.11.2026: изолированный локальный PostgreSQL запущен, SQL-прогоны выполнены. Ниже сохранён исходный аудит; актуальное состояние — local-qa.md.

# QA: обнаружение и оставшиеся условия

Проверка 17.11.2026 была read-only. Найден production Supabase `yqezhfughtublpaitmij`, организация eneca.work. Branches: пусто. Изолированная база/деплой не подтверждены; это не доказательство их отсутствия. Локальных .env и .vercel нет. Успешный Vercel status ветки сам по себе не доказывает изоляцию данных.

## Внешние назначения

| Назначение | Обнаружено | Условие QA |
| --- | --- | --- |
| Supabase | Production ref выше | Отдельная база, ключи и Storage; никаких production ключей в QA |
| Cron | Один активный process-day-off-requests, каждые 2 минуты; команда SQL | Разобрать вызываемые функции/HTTP до переноса; не активировать заранее |
| Исторические миграции | Есть ссылки на production sync-plugin-launches | Не применять цепочку автоматически, подготовить проверенный baseline |
| Teams orders/feedback | Env TEAMS_ORDERS_WEBHOOK_URL / TEAMS_FEEDBACK_WEBHOOK_URL | Отдельные тестовые каналы/URL, фактическая доставка |
| Airtable | base appKHrxgAJFFZeeQO, table tblchPw2DdhHkD0FD hardcoded | Отдельные base/table/token; конкретный diff ниже согласовать |
| Worksection | OAuth client/secret/redirect URI | Проверенные тестовые credentials/redirect и запрет фонового production sync |
| Новое подтверждение рулетки | ROULETTE_CONFIRMATION_SECRET | Отдельный server-only случайный секрет минимум 32 байта; без NEXT_PUBLIC |
| Vercel / browser / DB connection | QA доступы не подтверждены | Production-сборка на проверенном QA, отдельные тестовые сотрудники |

До активации: инвентаризация env **по именам/назначениям без публикации секретов**, cron/jobs, HTTP-функций и trigger dependencies, storage/webhooks, OAuth callback; после каждого restore/migration повторить. Наличие слова dev в URL не считается проверкой изоляции.

## Ресурсы и расходы

Ресурсы не создавались. Пользователь подтвердил eneca.work для расчёта; MCP вернул project $10/month и branch $0.01344/hour, организация Pro. Рекомендован отдельный пустой Micro-проект. Период начисления, доплаты, состав и безопасный baseline: [qa-proposal.md](qa-proposal.md). Создание и расходы ещё не разрешены.

## Airtable: только предложение, не реализовано

Предлагаемый минимальный diff:
- `src/config/airtable.ts`: baseId читать из server-only AIRTABLE_FEEDBACK_BASE_ID; отсутствие значения — явная ошибка конфигурации без fallback в production base.
- `src/modules/feedback/actions.ts`: tableId читать из AIRTABLE_FEEDBACK_TABLE_ID, сохранив формат отправляемой записи.
- AIRTABLE_FEEDBACK_TOKEN остаётся отдельным секретом тестовой интеграции.
- После согласования проверить real delivery в утверждённые тестовые base/table; заглушка проверяет только локальный payload.

Перед реализацией этого diff ещё требуется отдельное согласование. Не менялись адреса, токены или назначения production.

## Блокированные проверки

Применение SQL/QA helpers; семь исходов в реальной БД; два соединения и гонки покупки/начисления; rollback; реальные доставки; production build с QA auth; полная функциональная/визуальная приёмка; baseline производительности. Локальные unit/component тесты не заменяют эти проверки.
