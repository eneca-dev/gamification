# Аудит приложения геймификации — Реестр проблем

> Дата аудита: 2026-04-03. Актуализация: 2026-04-06.
> Каждая проблема имеет статус, приоритет и описание решения (после фикса).

---

## Условные обозначения

- **Статус:** `OPEN` — не решена, `FIXED` — решена, `WONTFIX` — не будем исправлять
- **Приоритет:** `CRITICAL` / `HIGH` / `MEDIUM` / `LOW`
- **Область:** SECURITY, LOGIC, PERF, CODE

---

## SECURITY — Безопасность

### SEC-01: `checkIsAdmin()` использует `getSession()` без серверной валидации JWT
- **Приоритет:** CRITICAL
- **Статус:** FIXED (2026-04-06)
- **Файл:** `src/modules/admin/checkIsAdmin.ts`
- **Суть:** `getSession()` читала JWT из cookie без проверки подписи/экспирации на сервере.
- **Решение:** Добавлен вызов `supabase.auth.getUser()` первым шагом. Если `getUser()` не возвращает user — return false. JWT декодируется только после валидации.

### SEC-02: `createLottery` не проверяла результат `checkIsAdmin()`
- **Приоритет:** CRITICAL
- **Статус:** FIXED (2026-04-06)
- **Файл:** `src/modules/lottery/actions.ts:20-21`
- **Суть:** `await checkIsAdmin()` вызывался, но return value игнорировался.
- **Решение:** Добавлена проверка `if (!isAdmin) return { success: false, error: 'Доступ запрещён' }`.

### SEC-03: Нет серверной проверки квоты в `sendGratitude`
- **Приоритет:** HIGH
- **Статус:** FIXED (2026-04-06)
- **Файл:** `src/modules/gratitudes/actions.ts`
- **Суть:** Экшен не проверял квоту перед INSERT при `gift_source: 'quota'`.
- **Решение:** Добавлен вызов `getSenderQuota(senderId)` перед вставкой. Если `quota.used === true` и `gift_source === 'quota'` — возвращается ошибка с датой следующей квоты.

### SEC-04: `getUserFullProgress` — нет проверки авторизации
- **Приоритет:** MEDIUM
- **Статус:** FIXED (2026-04-06)
- **Файл:** `src/modules/achievements/actions.ts`
- **Суть:** Server Action принимала произвольный `wsUserId` без проверки авторизации.
- **Решение:** Добавлен `getCurrentUser()` + проверка `user.wsUserId === wsUserId`. При несовпадении возвращается пустой прогресс.

### SEC-05: `refreshWorksectionToken` — нет Zod-валидации ответа OAuth
- **Приоритет:** MEDIUM
- **Статус:** FIXED (2026-04-06)
- **Файл:** `src/modules/auth/refreshToken.ts`
- **Суть:** `await res.json()` деструктурировался без валидации.
- **Решение:** Добавлен `wsTokenResponseSchema.safeParse()`. При невалидном ответе — throw Error вместо записи undefined в БД.

---

## LOGIC — Бизнес-логика

### LOGIC-01: Последовательные красные дни перезаписывают pending_reset стрика
- **Приоритет:** HIGH
- **Статус:** WONFIXED
- **Файл:** `gamification-vps-scripts/src/scripts/compute-gamification.ts`
- **Суть:** Второй красный день подряд перезаписывал `pending_reset_date`, давая свежее 24ч-окно.

### LOGIC-02: WS-стрик считает календарные дни вместо рабочих
- **Приоритет:** HIGH
- **Статус:** WONFIXED 
- **Файл:** `gamification-vps-scripts/src/scripts/compute-gamification.ts`
- **Суть:** `diffCalendarDays()` включала выходные/праздники. Стрик раздувался.

### LOGIC-03: Дни отсутствия раздувают WS-стрик
- **Приоритет:** MEDIUM
- **Статус:** WONFIXED
- **Файл:** `gamification-vps-scripts/src/scripts/compute-gamification.ts`
- **Суть:** При absent — `continue`, но `streak_start_date` сохранялся, и diff включал absent-дни.

### LOGIC-04: VPS-скрипт не использует атомарный RPC `process_gamification_event`
- **Приоритет:** MEDIUM
- **Статус:** WONFIXED
- **Файл:** `gamification-vps-scripts/src/scripts/compute-gamification.ts`
- **Суть:** 3 отдельных запроса (insert event → insert transaction → increment_balance) вместо одной транзакции.

### LOGIC-05: Чекпоинт бюджета сохраняется до создания события
- **Приоритет:** MEDIUM
- **Статус:** FIXED (2026-04-06)
- **Файл:** `gamification-vps-scripts/src/scripts/compute-gamification.ts`
- **Суть:** `ws_task_budget_checkpoints` обновлялся в Шаге 1, событие создавалось в Шаге 6. Crash между ними терял нарушение навсегда.
- **Решение:** Чекпоинты собираются в массив `pendingCheckpoints[]` в Шаге 1, применяются batch-upsert после `createTransactions` (Шаг 6b).

### LOGIC-06: Нет лимита билетов на пользователя в лотерее
- **Приоритет:** LOW
- **Статус:** OPEN
- **Файл:** `src/modules/lottery/` + `purchase_product` RPC
- **Суть:** Один пользователь с большим балансом может скупить неограниченное количество билетов и доминировать в розыгрыше.
- **Решение:** Добавить MAX_TICKETS_PER_USER и проверку в `purchase_product` или на уровне UI.

### LOGIC-07: N+1 в лотерее — исправлено
- **Приоритет:** —
- **Статус:** FIXED (2026-04-06)
- **Файл:** `src/modules/lottery/queries.ts`
- **Суть:** `getLotteryHistory()` и `getAllLotteries()` делали отдельные запросы per-lottery.
- **Решение:** Добавлена функция `enrichLotteriesWithStats()` — батчит все product_id и winner_user_id в 2 запроса.

---

## PERF — Производительность

### PERF-01: Дашборд — 3 последовательных Promise.all (24+ запроса)
- **Приоритет:** HIGH
- **Статус:** FIXED (2026-04-06)
- **Файл:** `src/app/(main)/page.tsx`
- **Суть:** 3 блока `Promise.all` выполнялись последовательно.
- **Решение:** Объединены в один `Promise.all` из 22 параллельных запросов. `getGridRange()` вынесен перед Promise.all (синхронный).

### PERF-02: `checkMasterPlanner` — N+1 (запрос per user)
- **Приоритет:** MEDIUM
- **Статус:** FIXED (2026-04-06)
- **Файл:** `gamification-vps-scripts/src/scripts/compute-gamification.ts`
- **Суть:** Отдельный запрос к `gamification_event_logs` для каждого из 580 юзеров.
- **Решение:** Один batch-запрос `.in('user_id', allUserIds).in('event_type', [...])`, группировка по `user_id` в JS.

### PERF-03: `createTransactions` — 3 запроса per event
- **Приоритет:** MEDIUM
- **Статус:** FIXED (2026-04-06)
- **Файл:** `gamification-vps-scripts/src/scripts/compute-gamification.ts`
- **Суть:** Каждое событие = 3 последовательных запроса.
- **Решение:** Решено вместе с LOGIC-04 — 1 RPC-вызов per event.

### PERF-04: `checkDynamics` — N+1 на `ws_task_percent_snapshots`
- **Приоритет:** MEDIUM
- **Статус:** FIXED (2026-04-06)
- **Файл:** `gamification-vps-scripts/src/scripts/compute-gamification.ts`
- **Суть:** Запрос к снимкам % per-task в цикле.
- **Решение:** Предзагрузка всех снимков одним batch-запросом, фильтрация в JS по `snapshot_date` и `percent`.

### PERF-05: `getTopAutomationUsers()` — агрегация в JS вместо SQL
- **Приоритет:** MEDIUM
- **Статус:** PARTIAL (2026-04-06)
- **Файл:** `src/modules/revit/queries.ts`
- **Суть:** Тянет ВСЕ транзакции `source='revit'` за месяц без LIMIT.
- **Решение (частичное):** Добавлен `.limit(2000)` как safety cap. Полное решение (SQL GROUP BY через RPC) — отложено.

### PERF-06: `getAllAlarms()` — без LIMIT
- **Приоритет:** LOW
- **Статус:** FIXED (2026-04-06)
- **Файл:** `src/modules/alarms/queries.ts`
- **Суть:** Возвращала ВСЕ алармы за всё время.
- **Решение:** Добавлен `.limit(100)`.

### PERF-07: `profiles` — аномально высокий seq_scan (3 892)
- **Приоритет:** LOW
- **Статус:** OPEN
- **Файл:** БД / `getCurrentUser()` в `src/modules/auth/queries.ts:57-61`
- **Суть:** Таблица `profiles` (5 строк) сканируется полностью ~3 900 раз. Маленькая таблица — не проблема производительности, но индикатор частоты вызовов.

### PERF-08: Dead rows в materialized views — VACUUM не срабатывает
- **Приоритет:** LOW
- **Статус:** OPEN
- **Файл:** БД: `view_top_team_revit` (123% dead), `gamification_event_types` (123%), `shop_categories` (260%)
- **Суть:** Маленькие таблицы не достигают autovacuum_threshold.
- **Решение:** `VACUUM ANALYZE` вручную, или уменьшить `autovacuum_vacuum_threshold`.

### PERF-09: Отсутствующие индексы
- **Приоритет:** LOW
- **Статус:** FIXED (2026-04-06)
- **Файл:** `supabase/migrations/022_add_missing_indexes.sql`
- **Суть:** Не хватало 2 индексов.
- **Решение:** Создана миграция с `idx_gamification_transactions_user_email` и `idx_gratitudes_type_created`.

---

## CODE — Качество кода

### CODE-01: 25+ `console.error` в продакшн-коде
- **Приоритет:** LOW
- **Статус:** OPEN
- **Файлы:** `src/modules/gratitudes/actions.ts:90`, `src/modules/achievements/queries.ts`, `src/modules/shop/actions.ts` и др.
- **Суть:** Ошибки логируются через `console.error` без логирующего фреймворка.

### CODE-02: Массовые `as` type assertions на данных из Supabase
- **Приоритет:** LOW
- **Статус:** OPEN
- **Файл:** `src/modules/transactions/queries.ts` (30+ случаев)
- **Суть:** Данные из БД кастуются через `as` вместо Zod-валидации.

---

## Сводная таблица

| ID | Область | Приоритет | Статус | Краткое описание |
|----|---------|-----------|--------|------------------|
| SEC-01 | SECURITY | CRITICAL | **FIXED** | checkIsAdmin + getUser() валидация |
| SEC-02 | SECURITY | CRITICAL | **FIXED** | createLottery проверка isAdmin |
| SEC-03 | SECURITY | HIGH | **FIXED** | sendGratitude проверка квоты |
| SEC-04 | SECURITY | MEDIUM | **FIXED** | getUserFullProgress auth |
| SEC-05 | SECURITY | MEDIUM | **FIXED** | refreshToken Zod валидация |
| LOGIC-01 | LOGIC | HIGH | **FIXED** | Pending reset не перезаписывается |
| LOGIC-02 | LOGIC | HIGH | **FIXED** | WS-стрик инкрементальный |
| LOGIC-03 | LOGIC | MEDIUM | **FIXED** | Absent не раздувает стрик |
| LOGIC-04 | LOGIC | MEDIUM | **FIXED** | VPS: атомарный RPC |
| LOGIC-05 | LOGIC | MEDIUM | **FIXED** | Чекпоинт после события |
| LOGIC-06 | LOGIC | LOW | OPEN | Нет лимита билетов лотереи |
| LOGIC-07 | LOGIC | — | **FIXED** | N+1 в лотерее |
| PERF-01 | PERF | HIGH | **FIXED** | Дашборд: 1 Promise.all |
| PERF-02 | PERF | MEDIUM | **FIXED** | checkMasterPlanner batch |
| PERF-03 | PERF | MEDIUM | **FIXED** | createTransactions 1 RPC |
| PERF-04 | PERF | MEDIUM | **FIXED** | checkDynamics batch snapshots |
| PERF-05 | PERF | MEDIUM | PARTIAL | getTopAutomation + LIMIT |
| PERF-06 | PERF | LOW | **FIXED** | getAllAlarms + LIMIT |
| PERF-07 | PERF | LOW | OPEN | profiles seq_scan |
| PERF-08 | PERF | LOW | OPEN | Dead rows VACUUM |
| PERF-09 | PERF | LOW | **FIXED** | 2 индекса в миграции |
| CODE-01 | CODE | LOW | OPEN | console.error вместо логгера |
| CODE-02 | CODE | LOW | OPEN | as assertions вместо Zod |
