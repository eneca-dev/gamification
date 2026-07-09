# План: миграция Revit-стрика на VPS + новая модель стрика

## Контекст

Сейчас Revit-стрик ведёт триггер `fn_award_revit_points` в БД (на каждый INSERT в `elk_plugin_launches`), а Kibana-синк живёт в Edge Function `sync-plugin-launches`, запускаемой через `pg_cron`. Финализация просроченных pending делается из той же Edge Function.

Проблемы:

- Стрик в `revit_user_streaks.current_streak` обновляется только в момент работы триггера и «застывает» между запусками плагинов — UI показывает старое значение.
- Финализация pending зависит от прогона Edge Function — пока он не отработал, стрик в таблице остаётся «дореdным».
- Логика расчёта размазана между триггером БД и Edge Function. Сложно отлаживать и сравнивать с WS.
- Модель не считает выходные/праздники как «+1»: пропуск в Сб/Вс не сбивает стрик только потому, что `gap_days` фильтрует выходные, а не потому, что они засчитываются.

Цель: повторить архитектуру WS-стрика для Revit. Стрик считается view-walk'ом на чтение, расчёт переезжает на VPS под общий оркестратор.

## Прогресс

- [x] Шаг 1 — миграция БД (файлы созданы, **миграция 040 применена к проду 2026-04-28**)
- [x] Шаг 2 — бэкфилл `streak_start_date` (применён через SQL прямо в Supabase 2026-04-28; 133 пользователя, 0 пропусков)
- [x] Шаг 3 — VPS `sync-plugin-launches.ts` (создан, **не задеплоен — нужен push в main**)
- [x] Шаг 4 — VPS `compute-revit-gamification.ts` (создан, **не задеплоен**; добавлен event_type `revit_streak_reset` в миграцию 040)
- [x] Шаг 5 — Telegram refactor (два канала; env.ts расширен)
- [x] Шаг 6 — оркестратор (два пайплайна, fatal в оба чата)
- [x] Шаг 7 — фронт на view (queries в streak-panel, revit, streak-shield; legacy-поля `last_green_date`/`is_frozen` удалены из типа `RevitStreak`)
- [x] Шаг 8 — `compute-achievements.ts` (создан, подключён в `wsSteps` оркестратора)
- [x] Шаг 9 — миграции 041/042 + очистка Edge Function. **Решение: Edge Function удаляется сразу после первого успешного ночного прогона VPS, без 1-2 недель холодного периода — VPS-скрипты полностью её замещают.**
- [x] Шаг 10 — документация (3 новых docs/scripts/_.md в vps; 5 docs обновлены в gamification; PLAN.md и docs/_ в vps обновлены)

## Замечание по применению миграций

**Я не применяю миграции автоматически.** Все SQL-файлы создаются в `supabase/migrations/`, но `supabase migration up` (или эквивалент) запускается вручную в момент, описанный в [Порядок выкатки](#порядок-выкатки).

Критическая зависимость: Edge Function `sync-plugin-launches` вызывает `fn_finalize_expired_revit_pendings` ([supabase/functions/sync-plugin-launches/index.ts:182](../../../supabase/functions/sync-plugin-launches/index.ts#L182)). Если применить `040_revit_streak_view.sql` (с `DROP FUNCTION`) до того, как Edge Function перестанет звать эту функцию, очередной прогон Edge упадёт с ошибкой RPC. Поэтому DROP-часть вынесена в отдельную миграцию `041_drop_fn_finalize_expired_revit_pendings.sql` — она применяется позже, когда VPS уже взял финализацию на себя и Edge Function либо обновлена, либо снята с cron.

Итоговый порядок применения миграций:

- `040_revit_streak_view.sql` — ALTER + CREATE VIEW + упрощённая `fn_award_revit_points`. **Применяется первой**, после её применения Edge Function продолжает работать как раньше (вызов `fn_finalize_expired_revit_pendings` ещё валиден).
- `041_drop_fn_finalize_expired_revit_pendings.sql` — DROP FUNCTION. **Применяется позже**, после Шага 9 (декомиссия Edge Function / удаление вызова из её кода).

## Целевая архитектура

|                     | WS (как есть)                            | Revit (целевое)                                             |
| ------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| Сырые данные        | `ws_daily_reports`, `ws_tasks_*`         | `elk_plugin_launches`                                       |
| Per-day статусы     | `ws_daily_statuses`                      | **не нужны** (walk прямо по сырым)                          |
| Стрик на UI         | view `ws_user_streaks_effective`         | **новая** view `revit_user_streaks_effective`               |
| Снапшот             | `ws_user_streaks`                        | `revit_user_streaks` (+ `streak_start_date`)                |
| Кто пишет           | VPS `compute-gamification`               | **новый** VPS `compute-revit-gamification`                  |
| Финализация pending | phase 1 vps + view-fallback после грейса | phase 1 vps + view-fallback после грейса                    |
| Триггер на launch   | —                                        | **упрощён**: только идемпотентный лог + 5 💎, без стрика    |
| Kibana-синк         | —                                        | **новый** VPS `sync-plugin-launches` (вместо Edge Function) |

### Семантика дельт view (зеркало WS)

Для каждого дня `d ∈ [streak_start_date, fn_minsk_today() - 1]`:

- `d ∈ ws_user_absences` (vacation / sick_leave / sick_day) → **0** (заморозка)
- `d ∈ calendar_workdays` → green if `exists(elk_plugin_launches on d)` else red
- `dow(d) ∈ (0, 6)` (Сб/Вс) → **+1** (выходной)
- `d ∈ calendar_holidays` → **+1** (праздник)
- иначе (будний рабочий день) → green if `exists(elk_plugin_launches on d)` else red

Где: `green → +1`, `red → 0`. Pending grace: пока `pending_reset_expires_at > now()` view возвращает замороженное `current_streak` из таблицы, после — пересчитанное.

### Цикл и milestones

- Цикл — **30 дней** (как сейчас в Revit, не унифицируем с WS-90).
- Milestones: 7 / 30 — пересечение порога (`prev < T ∧ T ≤ next`), не точное равенство. Защищает от пропуска награды через выходные.
- На 30 — бонус, `current_streak = 0`, `streak_start_date = null`, `completed_cycles += 1`.

## Что делаем

### Шаг 1. ✅ Миграция БД (`040_revit_streak_view.sql`)

Файлы созданы, миграции **не применены** — применяются вручную в порядке, описанном ниже.

**1a. ALTER `revit_user_streaks`**

```sql
ALTER TABLE revit_user_streaks
  ADD COLUMN streak_start_date date NULL;
```

Якорь walk'а — день первого зелёного в текущей серии. Для существующих стриков заполняется бэкфиллом (Шаг 2).

**1b. CREATE VIEW `revit_user_streaks_effective`**

Структурно — копия [039_ws_user_streaks_effective_view.sql](../../../supabase/migrations/039_ws_user_streaks_effective_view.sql), но без отдельной таблицы статусов: дельта вычисляется в `CASE` прямо по `elk_plugin_launches`, `ws_user_absences`, `calendar_holidays`, `calendar_workdays`, `ws_users.email`.

```sql
CREATE OR REPLACE VIEW revit_user_streaks_effective
WITH (security_invoker = true)
AS
WITH walk AS (
  SELECT
    s.user_id,
    u.email,
    generate_series(
      CASE
        WHEN s.pending_reset_expires_at IS NOT NULL
             AND s.pending_reset_expires_at <= now()
        THEN (s.pending_reset_date + INTERVAL '1 day')::date
        ELSE s.streak_start_date
      END,
      fn_minsk_today() - INTERVAL '1 day',
      '1 day'
    )::date AS d
  FROM revit_user_streaks s
  JOIN ws_users u ON u.id = s.user_id
  WHERE s.streak_start_date IS NOT NULL
     OR s.pending_reset_date IS NOT NULL
),
deltas AS (
  SELECT
    w.user_id,
    CASE
      -- absent → 0
      WHEN EXISTS (
        SELECT 1 FROM ws_user_absences a
        WHERE a.user_email = lower(w.email) AND a.absence_date = w.d
      ) THEN 0
      -- workday override (calendar_workdays — рабочая суббота и т.п.)
      WHEN EXISTS (
        SELECT 1 FROM calendar_workdays cw WHERE cw.date = w.d
      ) THEN
        CASE WHEN EXISTS (
          SELECT 1 FROM elk_plugin_launches l
          WHERE l.user_email = lower(w.email) AND l.work_date = w.d
        ) THEN 1 ELSE 0 END
      -- weekend → +1
      WHEN extract(dow FROM w.d) IN (0, 6) THEN 1
      -- holiday → +1
      WHEN EXISTS (
        SELECT 1 FROM calendar_holidays h WHERE h.date = w.d
      ) THEN 1
      -- workday: green if launches, else red
      WHEN EXISTS (
        SELECT 1 FROM elk_plugin_launches l
        WHERE l.user_email = lower(w.email) AND l.work_date = w.d
      ) THEN 1
      ELSE 0
    END AS delta
  FROM walk w
),
summed AS (
  SELECT user_id, SUM(delta)::int AS computed
  FROM deltas
  GROUP BY user_id
)
SELECT
  s.user_id,
  s.longest_streak,
  s.completed_cycles,
  s.streak_start_date,
  s.pending_reset_date,
  s.pending_reset_expires_at,
  CASE
    WHEN s.pending_reset_expires_at IS NOT NULL
     AND s.pending_reset_expires_at > now()
    THEN s.current_streak
    ELSE COALESCE(sm.computed, 0)
  END AS current_streak
FROM revit_user_streaks s
LEFT JOIN summed sm ON sm.user_id = s.user_id;

GRANT SELECT ON revit_user_streaks_effective TO service_role;
```

**1c. Упростить `fn_award_revit_points`**

Оставляем только:

- Идемпотентный INSERT в `gamification_event_logs` с накоплением `details.plugins[]`.
- Транзакция +5 💎 на первый плагин дня (`revit_using_plugins`) → `gamification_transactions` + `gamification_balances`.

Полностью убираем:

- Все ветки про `revit_user_streaks` (UPDATE стрика, milestones 7/30, completed_cycles).
- Расчёт `gap_days`, pending, сброс.

Также важно: триггер больше **не пишет** `last_green_date` — это поле остаётся как legacy, не используется. Можно дропнуть отдельной миграцией позже.

**1d. Не дропаем `fn_finalize_expired_revit_pendings` в этой миграции**

Edge Function `sync-plugin-launches` всё ещё вызывает эту функцию через RPC. Дроп выносим в отдельную миграцию `041_drop_fn_finalize_expired_revit_pendings.sql`, которая применяется на Шаге 9 — после того, как VPS взял финализацию и Edge Function либо обновлена, либо снята с cron.

Содержимое `041_drop_fn_finalize_expired_revit_pendings.sql`:

```sql
DROP FUNCTION IF EXISTS public.fn_finalize_expired_revit_pendings();
```

### Шаг 2. ✅ Бэкфилл `streak_start_date`

Скрипт создан: [gamification-vps-scripts/scripts/backfill-revit-streak-start.ts](../../../../gamification-vps-scripts/scripts/backfill-revit-streak-start.ts). **Не запущен** — запускать вручную через `npm run backfill:revit-streak` (dry-run по умолчанию) и `npm run backfill:revit-streak -- --apply` для записи. Лучше под `TZ=Europe/Minsk`, чтобы `getYesterday()` дал правильный якорь.

Одноразовый скрипт **вне оркестратора**, запускается руками. Чтобы не путать его с ежедневными шагами в `src/scripts/`, кладём в `gamification-vps-scripts/scripts/backfill-revit-streak-start.ts` (отдельная папка `scripts/` в корне репо). Использует общие `lib/supabase.ts`, `lib/logger.ts`, `lib/telegram.ts`. npm-алиас в `package.json`: `"backfill:revit-streak": "tsx scripts/backfill-revit-streak-start.ts"`.

Логика:

1. Для каждого пользователя из `revit_user_streaks` где `current_streak > 0`:
   - Найти последний red-день (рабочий день без записи в `elk_plugin_launches`, не в `ws_user_absences`, не в `calendar_holidays`).
   - `streak_start_date = последний_red + 1`. Если red'ов нет — `streak_start_date = первый_green_day`.
2. Для пользователей с `current_streak = 0` и без `pending_reset_date` — оставить `NULL`.
3. Для активных pending — оставить `current_streak` и `pending_reset_*` нетронутыми; `streak_start_date` рассчитать как «начало серии до red, который сейчас в pending».
4. После обновления — выбрать `current_streak` из view и сравнить со старым в таблице. Расхождения вывести в **консоль** в виде таблицы (бэкфилл одноразовый, запускается руками — Telegram не нужен; к тому же на момент запуска `telegram.ts` ещё не отрефакторен под два канала).
5. Поддержать два режима: `--dry-run` (по умолчанию — только печать proposed updates, БД не трогаем) и `--apply` (UPDATE + divergence-репорт).

### Шаг 3. ✅ Новый VPS-скрипт `sync-plugin-launches.ts`

Создан: [gamification-vps-scripts/src/scripts/sync-plugin-launches.ts](../../../../gamification-vps-scripts/src/scripts/sync-plugin-launches.ts). В оркестратор пока **не подключён** — это делает Шаг 6. Env `KIBANA_URL` / `KIBANA_API_KEY` должны быть в `.env` на VPS перед деплоем.

Перенос логики Edge Function [supabase/functions/sync-plugin-launches/index.ts](../../../supabase/functions/sync-plugin-launches/index.ts) на VPS.

- **Файл**: `gamification-vps-scripts/src/scripts/sync-plugin-launches.ts`.
- **Зависимости**: `lib/supabase.ts` (общий клиент), `lib/logger.ts`, `lib/env.ts`. Helpers `getYesterday()`, `toIsoDate()` берём из существующего `lib/ws-api.ts` (несмотря на имя — это просто общие date-хелперы; альтернатива — вынести в `lib/dates.ts`, но это вне scope текущей задачи).
- **Env (новые)**: `KIBANA_URL`, `KIBANA_API_KEY`. Добавляются в `lib/env.ts` через `requireEnv()` (паттерн уже зафиксирован для `wsApiKey`, `supabaseUrl`).
- **HTTP в Kibana**: `fetch` напрямую в скрипте (Node 20+, без `lib/kibana.ts` — единственный потребитель, KISS). POST на `${KIBANA_URL}/kibana/internal/search/es` с composite aggregation за вчера по Минску. Список индексов (`PLUGIN_INDICES`) — копируется из Edge Function как локальная константа в файле.
- **Upsert** в `elk_plugin_launches` на `(user_email, work_date, plugin_name)`.
- **CLI**: `--days=N` для бэкфилла (default `1`). Парсится через `process.argv`, без сторонних либ.
- **Возвращает** `ScriptResult` со `stats`: `synced` (count), `days` (массив `{ date, synced }`), `errors` (массив строк, для Telegram-сводки).
- **npm-алиас**: `"sync:revit-plugins": "tsx src/scripts/sync-plugin-launches.ts"` в `package.json`.
- **Самостоятельный запуск**: `process.argv[1]?.includes('sync-plugin-launches')` → `.catch()` + `process.exit(1)` — паттерн всех остальных скриптов в `src/scripts/`.

Из Edge Function вызовы `fn_finalize_expired_revit_pendings` убираем на Шаге 9 (теперь это phase 1 в `compute-revit-gamification`). Сама Edge Function остаётся живой только для постпроцессинга ачивок до Шага 8.

### Шаг 4. ✅ Новый VPS-скрипт `compute-revit-gamification.ts`

Создан: [gamification-vps-scripts/src/scripts/compute-revit-gamification.ts](../../../../gamification-vps-scripts/src/scripts/compute-revit-gamification.ts). В оркестратор пока **не подключён** — это делает Шаг 6.

В миграцию `040` добавлен новый event*type `revit_streak_reset` (coins=0) — используется Phase 1 при финализации просроченных pending. Аналог WS `streak_reset*\*`.

- **Файл**: `gamification-vps-scripts/src/scripts/compute-revit-gamification.ts`. Структурно — облегчённая копия `updateStreaks` блока из [compute-gamification.ts:509-695](../../../../gamification-vps-scripts/src/scripts/compute-gamification.ts#L509-L695). Адаптации: `ws_user_streaks` → `revit_user_streaks`, `ws_user_streaks_effective` → `revit_user_streaks_effective`, статусы вычисляются прямо из `elk_plugin_launches` + `ws_user_absences` + `calendar_*` (без `ws_daily_statuses`), milestones 7/30 вместо 7/30/90.
- **Зависимости**: `lib/supabase.ts`, `lib/logger.ts`, `lib/types.ts` (`ScriptResult`).
- **Helpers**: `getYesterday()`, `toIsoDate()` — из `lib/ws-api.ts`. `addDaysIso()` — копируется из `compute-gamification.ts:503-507` (или выносится в `lib/dates.ts` — отдельной задачей, не в этом скоупе).
- **npm-алиас**: `"compute:revit": "tsx src/scripts/compute-revit-gamification.ts"`.
- **Самостоятельный запуск**: `process.argv[1]?.includes('compute-revit-gamification')` → `.catch()` + `process.exit(1)`.

**Phase 1 — финализация просроченных pending**

```sql
SELECT user_id, current_streak, pending_reset_date
FROM revit_user_streaks
WHERE pending_reset_date IS NOT NULL
  AND pending_reset_date < <yesterdayIso>;
```

Для каждой строки:

- Эмитим событие `revit_streak_reset` с `details: { streak_was, shield_expired: true }`, идемпотентный ключ `revit_streak_reset_<user_id>_<pending_reset_date>`.
- UPDATE: `current_streak = 0`, `streak_start_date = pending_reset_date + 1`, `pending_reset_date = NULL`, `pending_reset_expires_at = NULL`, `pending_gap_days = NULL`.

**Phase 2 — обработка вчерашнего дня**

Преднагрузка в память:

- Все `ws_users` (id, email, is_active).
- `elk_plugin_launches` за вчера (Set email'ов с launches).
- `ws_user_absences` за вчера (Set email'ов).
- `calendar_holidays` / `calendar_workdays` для вчерашней даты (boolean).

Для каждого активного `ws_user`:

1. **Определение статуса вчера**:
   - `email ∈ absences` → `absent` → пропуск (стрик не трогаем).
   - Вчера не рабочий день (`dow ∈ {0,6} ∧ ∉ workdays` ИЛИ `∈ holidays`) → пропуск (выходной обрабатывается view'ом, скрипту делать нечего).
   - Иначе рабочий: `launched ? green : red`.

2. **Загружаем `revit_user_streaks` строку** (или создаём дефолтную).

3. **`green`**:
   - Если `streak_start_date IS NULL` → ставим `streak_start_date = yesterday`, `next = 1`.
   - Иначе → читаем `current_streak` из `revit_user_streaks_effective` для этого user_id.
   - Milestones (через пересечение порога):
     - `prev < 7 ∧ 7 ≤ next` → событие `revit_streak_7_bonus`, ключ `revit_streak_7_<user_id>_<yesterday>`.
     - `prev < 30 ∧ 30 ≤ next` → событие `revit_streak_30_bonus`, ключ `revit_streak_30_<user_id>_<yesterday>`. После — `current_streak = 0`, `streak_start_date = NULL`, `completed_cycles += 1`.
   - Upsert строки в `revit_user_streaks` (включая чистку `pending_*`).

4. **`red`**:
   - Если `current_streak > 0 ∧ pending_reset_date IS NULL`:
     - UPDATE: `pending_reset_date = yesterday`, `pending_reset_expires_at = now() + 24h`. `current_streak` НЕ трогаем (view вернёт его как замороженный во время грейса).
   - Если уже есть pending — не перезаписываем `expires_at`, иначе грейс продлится.
   - Если `current_streak == 0` — нечего защищать, ничего не делаем.

5. **Запись событий и транзакций**:
   - Все события из Phase 1 + milestones из Phase 2 → batch INSERT в `gamification_event_logs` (ON CONFLICT DO NOTHING по `idempotency_key`).
   - Для каждого нового события — INSERT в `gamification_transactions` и UPDATE `gamification_balances` (в одной transaction, как в WS-скрипте).

**Stats для Telegram-репорта**:

- `green_days`, `red_days`, `absent_days`
- `streak_milestones`
- `pending_set` (новых pending за прогон)
- `pending_finalized` (сброшено просроченных)
- `events_created`, `transactions_created`
- `errors`

### Шаг 5. ✅ Telegram: разделение на два чата

Реализовано: [lib/env.ts](../../../../gamification-vps-scripts/src/lib/env.ts) расширен (5 telegram-полей), [lib/telegram.ts](../../../../gamification-vps-scripts/src/lib/telegram.ts) рефакторен под `Channel = 'ws' | 'revit'`, `send(text, channel)`, `getMention(channel)`. STAT_LABELS дополнены ярлыками для revit/ачивочных статистик.

Текущий [lib/telegram.ts](../../../../gamification-vps-scripts/src/lib/telegram.ts) знает только один чат, и читает env **напрямую через `process.env`** на уровне модуля (строки 5-7), в обход `lib/env.ts`. Унифицируем паттерн: все env-переменные проходят через `env.ts`.

**Env**:

```
TELEGRAM_BOT_TOKEN=<существующий>
TELEGRAM_CHAT_ID_WS=-1003861305864
TELEGRAM_MENTION_WS=@brrr_s
TELEGRAM_CHAT_ID_REVIT=<правильный chat_id>
TELEGRAM_MENTION_REVIT=
```

Старые `TELEGRAM_CHAT_ID` и `TELEGRAM_MENTION` удаляются. `TELEGRAM_BOT_TOKEN` остаётся один — токен общий, разделяется только chat_id.

**Код**:

- `lib/env.ts` — добавить:
  - `telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? ''` (опционально — если пусто, send() пропускает отправку с warn-логом)
  - `telegramChatIdWs: process.env.TELEGRAM_CHAT_ID_WS ?? ''`
  - `telegramChatIdRevit: process.env.TELEGRAM_CHAT_ID_REVIT ?? ''`
  - `telegramMentionWs: process.env.TELEGRAM_MENTION_WS ?? ''`
  - `telegramMentionRevit: process.env.TELEGRAM_MENTION_REVIT ?? ''`
    Telegram-поля — НЕ через `requireEnv()` (фича опциональная, должна работать без неё).
- `lib/telegram.ts`:
  - Подпись: `send(text: string, channel: 'ws' | 'revit'): Promise<void>` и `getMention(channel: 'ws' | 'revit'): string`.
  - Внутри: маппинг `channel → { chatId, mention }` через `env.telegramChatId{Ws,Revit}` / `env.telegramMention{Ws,Revit}`.
  - `isConfigured(channel)` — проверка наличия токена + chatId для конкретного канала.
  - В `STAT_LABELS` добавить ярлыки для новых revit-статистик: `pending_set`, `pending_finalized`, `synced` (Kibana). Без ярлыка — ключ выводится как есть, но «человекочитаемая» сводка ценнее.

### Шаг 6. ✅ Оркестратор: два пайплайна и две сводки

Реализовано: [src/orchestrator.ts](../../../../gamification-vps-scripts/src/orchestrator.ts) переписан. `wsSteps` (8 шагов) и `revitSteps` (2 шага) — два независимых блока, каждый с try/catch на уровне блока + try/catch на уровне шага. Сводка отправляется в свой канал. Fatal-error в `main().catch()` уходит в оба чата через `Promise.allSettled`. compute-achievements в orchestrator пока не подключён — это Шаг 8.

[src/orchestrator.ts](../../../../gamification-vps-scripts/src/orchestrator.ts) — рефакторинг под два набора шагов:

```ts
const wsSteps: Step[] = [
  { name: "sync-ws-users", fn: syncWsUsers },
  { name: "sync-ws-projects", fn: syncWsProjects },
  { name: "sync-ws-tasks", fn: syncWsTasks },
  { name: "sync-ws-costs", fn: syncWsCosts },
  { name: "sync-task-events", fn: syncTaskEvents },
  { name: "snapshot-task-percent", fn: snapshotTaskPercent },
  { name: "sync-ws-absences", fn: syncWsAbsences },
  { name: "compute-gamification", fn: computeGamification },
];

const revitSteps: Step[] = [
  { name: "sync-plugin-launches", fn: syncPluginLaunches },
  { name: "compute-revit-gamification", fn: computeRevitGamification },
];
```

Логика:

1. Прогнать `wsSteps` последовательно, собрать сводку → `send(wsMessage, 'ws')`. Mention `@brrr_s` при ошибках через `getMention('ws')`.
2. Прогнать `revitSteps` последовательно, собрать сводку → `send(revitMessage, 'revit')`. Без mention'а (`TELEGRAM_MENTION_REVIT=''`).
3. Fatal-error в `main().catch(...)` — `Promise.allSettled([send(text, 'ws'), send(text, 'revit')])` чтобы упасть только если оба чата недоступны. Mention каждого канала свой.

Каждый блок шагов независим: Revit не зависит от WS-данных, но идёт после, чтобы избежать гонки на `gamification_balances` (бэкфилл-сценарии и `compute-gamification`/`compute-revit-gamification` оба пишут в один баланс). Если WS-блок упал на каком-то шаге — Revit-блок всё равно прогоняется (`try/catch` вокруг каждого блока, не вокруг всего пайплайна).

### Шаг 7. ✅ Фронт: переключение queries на view

Изменено:

- [src/modules/streak-panel/queries.ts](../../../modules/streak-panel/queries.ts) `_getRevitStreakData` — view вместо таблицы.
- [src/modules/revit/queries.ts](../../../modules/revit/queries.ts) `getRevitStreak` — view; `last_green_date`/`is_frozen` убраны (нигде в UI не читаются — поля удалены из типа `RevitStreak` в [revit/types.ts](../../../modules/revit/types.ts) полностью, не оставлены как legacy).
- [src/modules/streak-shield/queries.ts](../../../modules/streak-shield/queries.ts) `getActivePendings` — view для revit pending (логика щита эквивалентна, view возвращает frozen `current_streak` во время грейса).

⚠️ **Важно**: миграция 040 поправлена на `s.best_streak` (была опечатка `s.longest_streak` — такой колонки в `revit_user_streaks` нет, в отличие от WS).

[src/modules/streak-panel/queries.ts:89-114](../../../modules/streak-panel/queries.ts#L89-L114) — `getRevitStreakData(userId)`:

- `from('revit_user_streaks')` → `from('revit_user_streaks_effective')`.
- Добавить `completed_cycles` в select (если потом захотим показывать на UI — пока не показываем).

[src/modules/revit/queries.ts:38-70](../../../modules/revit/queries.ts#L38-L70) — `getRevitStreak(email)`:

- Тот же переход на view.
- `is_frozen` и `last_green_date` — оставить временно (виджет на дашборде их использует), читать из таблицы отдельным селектом если нужно.

### Шаг 8. ✅ Перенос ачивок на VPS (зависимость для Шага 9)

Создан: [gamification-vps-scripts/src/scripts/compute-achievements.ts](../../../../gamification-vps-scripts/src/scripts/compute-achievements.ts). Подключён последним шагом в `wsSteps` оркестратора. npm-алиас `compute:achievements`.

Edge Function [sync-plugin-launches/index.ts:191-207](../../../supabase/functions/sync-plugin-launches/index.ts#L191-L207) после Kibana-синка вызывает:

- `fn_ach_snapshot_rankings()`
- `fn_ach_check_gratitude_achievements()`

Если убрать Edge Function — ачивки сломаются. Поэтому до Шага 9 нужен отдельный шаг оркестратора `compute-achievements.ts`.

- **Файл**: `gamification-vps-scripts/src/scripts/compute-achievements.ts`.
- **Логика**: два `supabase.rpc(...)` вызова подряд, ошибки агрегируем в `stats.errors[]`.
- **Возвращает**: `ScriptResult` со `stats: { snapshot_ok: boolean, gratitude_ok: boolean, errors: string[] }`.
- **npm-алиас**: `"compute:achievements": "tsx src/scripts/compute-achievements.ts"`.
- **Размещение в оркестраторе**: добавляется в WS-блок последним шагом (логически ачивки больше связаны с WS-данными — рейтинги по часам, благодарности — но это конвенция, не зависимость).

### Шаг 9. ✅ Декомиссия Edge Function

Подготовлено (но **не применено к проду**):

- Миграция [supabase/migrations/042_unschedule_sync_plugin_launches.sql](../../../supabase/migrations/042_unschedule_sync_plugin_launches.sql) — снимает pg_cron расписание `sync-plugin-launches-daily`.
- Тело Edge Function [supabase/functions/sync-plugin-launches/index.ts](../../../supabase/functions/sync-plugin-launches/index.ts) очищено от вызовов `fn_finalize_expired_revit_pendings`, `fn_ach_snapshot_rankings`, `fn_ach_check_gratitude_achievements` — на случай если 042 применят раньше удаления функции.
- Миграция [supabase/migrations/041_drop_fn_finalize_expired_revit_pendings.sql](../../../supabase/migrations/041_drop_fn_finalize_expired_revit_pendings.sql) — финальный DROP, применяется после 042.

Edge Function удаляется чисто (`supabase functions delete sync-plugin-launches`) сразу после первого успешного ночного прогона VPS — оба пайплайна (Kibana-синк + ачивки + финализация pending) полностью покрыты VPS-скриптами. Холодного периода нет.

### Шаг 10. ✅ Документация

Обновлено:

- **gamification-vps-scripts**: новые `docs/scripts/sync-plugin-launches.md`, `compute-revit-gamification.md`, `compute-achievements.md`. Обновлены `docs/architecture.md`, `docs/orchestrator.md`, `docs/lib.md`, `PLAN.md`.
- **gamification (web)**: обновлены `src/docs/streak-panel.md`, `src/docs/revit.md`, `src/docs/streak-shield.md`, `src/docs/gamification-events.md`, `src/docs/gamification-db.md`.

- **Новые в `gamification-vps-scripts/docs/scripts/`**:
  - `sync-plugin-launches.md`
  - `compute-revit-gamification.md`
  - `compute-achievements.md`
- **Обновить в `gamification-vps-scripts/`**:
  - [docs/architecture.md](../../../../gamification-vps-scripts/docs/architecture.md) — структура `src/scripts/` (добавлены 3 новых), env Kibana, два TG-чата (`TELEGRAM_CHAT_ID_WS`, `TELEGRAM_CHAT_ID_REVIT`).
  - [docs/orchestrator.md](../../../../gamification-vps-scripts/docs/orchestrator.md) — два блока шагов (`wsSteps`, `revitSteps`), две сводки в TG, fatal-broadcast.
  - [docs/lib.md](../../../../gamification-vps-scripts/docs/lib.md) — `telegram.ts` сигнатура `send(text, channel)` / `getMention(channel)`, env-поля.
  - [PLAN.md](../../../../gamification-vps-scripts/PLAN.md) — пайплайн в «Архитектура» (8 ws + 2 revit), новые env-переменные, разделы «Скрипты 8-10» (sync-plugin-launches, compute-revit-gamification, compute-achievements).
- **Обновить в `gamification/src/docs/`**:
  - [streak-panel.md](../../streak-panel.md) — поменять упоминание `revit_user_streaks` → `revit_user_streaks_effective`, описать что Revit-стрик теперь считается так же, как WS.
  - [revit.md](../../revit.md) — удалить упоминание триггера-как-стрик-двигателя, добавить про view + VPS-расчёт.
  - [streak-shield.md](../../streak-shield.md) — обновить схему «Revit стрик» (убрать `fn_finalize_expired_revit_pendings`, заменить на phase 1 vps).
  - [gamification-events.md](../../gamification-events.md), [gamification-db.md](../../gamification-db.md) — крон `sync-plugin-launches-daily` удалён, расчёты Revit на VPS, добавлен view `revit_user_streaks_effective`.

## Порядок выкатки

В каждом пункте ниже указано **что применяется/деплоится** и какие миграции при этом накатываются.

1. ✅ **Применена миграция `040_revit_streak_view.sql`** (2026-04-28) — ALTER + CREATE VIEW + упрощённая `fn_award_revit_points`. БЕЗ дропа `fn_finalize_expired_revit_pendings`. Триггер больше не пишет в `revit_user_streaks`, но Edge Function продолжает работать.
2. ✅ **Бэкфилл `streak_start_date`** (2026-04-28, через SQL прямо в Supabase) — 133 пользователя, 0 пропусков. Расхождения: у 94 стрик стал больше (засчитываются выходные/праздники), у 24 меньше (рабочая суббота 25.04 как red), у 15 совпал.
3. **VPS-деплой**: коммит + push в `gamification-vps-scripts` main → GitHub Actions деплоит. На VPS добавить в `.env`: `KIBANA_URL`, `KIBANA_API_KEY`, `TELEGRAM_CHAT_ID_WS`, `TELEGRAM_MENTION_WS`, `TELEGRAM_CHAT_ID_REVIT`, `TELEGRAM_MENTION_REVIT`.
4. **Один ночной прогон оркестратора** — дождаться 0:30 Минск или ручной запуск. Проверить логи, оба Telegram-репорта. Edge Function в этот момент ещё работает (cron живой) — можно сравнить количество synced launches.
5. **Применить миграцию `042_unschedule_sync_plugin_launches.sql`** — снимаем cron Edge Function. С этого момента VPS — единственный источник Kibana-данных и финализации pending.
6. **Применить миграцию `041_drop_fn_finalize_expired_revit_pendings.sql`** — дроп безопасен: cron снят, VPS делает финализацию, web-репо `supabase/functions/sync-plugin-launches/index.ts` уже не зовёт эту RPC (если фронт-репо запушен).
7. **Удалить Edge Function**: `supabase functions delete sync-plugin-launches`.
8. **Фронт**: коммит + push web-репо. После merge dev → main фронт деплоится с queries на view.

## Риски и edge cases

- **Гонка на `gamification_balances`**: Revit и WS пишут в один баланс. В оркестраторе они идут последовательно — норм. Бэкфилл — обернуть upsert в RPC `purchase_product`-style или SELECT FOR UPDATE.
- **Идемпотентность milestones**: ключи `revit_streak_7_<user_id>_<date>` — те же, что у триггера. Если триггер уже выдал бонус, скрипт не выдаст повторно.
- **Активные pending на момент миграции**: VPS-скрипт первым прогоном корректно отработает — либо финализирует (phase 1), либо продлит (если грейс ещё активен).
- **Расхождения «было vs стало»**: новая модель «выходные = +1» теоретически совпадает со старой (старая через `gap_days` тоже фильтровала выходные). Но поведение во время грейса теперь чище: view сразу даёт замороженное значение, а не «текущее на момент последнего триггера».
- **`last_green_date`**: остаётся в таблице как legacy для виджета, не используется в логике стрика. Можно дропнуть позже.
- **Длинный walk при `streak_start_date` далеко в прошлом**: для пользователей с длинными сериями view может проходить 30+ дней. Производительность приемлемая (`generate_series` + три `EXISTS` — O(N) на одного юзера). Замерить на проде.
- **Отсутствие `ws_users.email`**: если у пользователя пустой email — view его пропустит (JOIN). В норме так и должно быть — без email не было бы и launches.

## Открытые вопросы

- ~~Цикл 30 vs 90~~ → оставлен 30 (не унифицируем с WS).
- ~~Нужна ли `revit_daily_statuses`~~ → не нужна, walk прямо по `elk_plugin_launches`.
- ~~Перенос Kibana на VPS~~ → переносим.
- **Telegram chat_id для Revit**: проверить, что `1903025102` — корректный ID (приватный или нужен префикс `-100`). Уточнить через `getUpdates` бота.

## Env (новые переменные)

`.env` в корне `gamification-vps-scripts/`:

```
# Kibana (для sync-plugin-launches) — обязательные, через requireEnv
KIBANA_URL=https://bim.eneca.by
KIBANA_API_KEY=<значение "encoded:" из письма>

# Telegram — опциональные (если нет — отправка в данный канал пропускается с warn)
TELEGRAM_BOT_TOKEN=<существующий>
TELEGRAM_CHAT_ID_WS=-1003861305864
TELEGRAM_MENTION_WS=@brrr_s
TELEGRAM_CHAT_ID_REVIT=<уточнить>
TELEGRAM_MENTION_REVIT=
```

Регистрация в `lib/env.ts`:

- Kibana — через `requireEnv()` (упадём на старте, если не заданы — это ок, скрипт без них бесполезен).
- Telegram — через `process.env.X ?? ''`, проверка на пустоту делается в `telegram.ts:isConfigured(channel)`.

Старые `TELEGRAM_CHAT_ID`, `TELEGRAM_MENTION`, `SYNC_SECRET` (последний — секрет Edge Function для bearer-auth) — удалить после декомиссии Edge Function (Шаг 9 порядка выкатки).
