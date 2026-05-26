# План безопасности — геймификация

Составлен: 2026-05-25

> Все изменения в этом плане проверены: **никакого кода менять не нужно**, только SQL.

## Что уже сделано

- ✅ Включён RLS на 4 таблицах без защиты:
  - `ws_task_status_changes`, `ws_daily_report_tasks`, `deadline_pending`, `admin_department_groups`
- ✅ Проверено: уязвимость `increment_balance` реально эксплуатируется (тестом)
- ✅ Проверено: никто кроме разработчиков ею не воспользовался

---

## План применения вечером

### 🔴 Критично

#### 1. REVOKE `increment_balance`

Любой авторизованный сотрудник мог начислить себе монеты — подтверждено тестом.

```sql
REVOKE EXECUTE ON FUNCTION public.increment_balance(uuid, integer)
  FROM PUBLIC, authenticated, anon;
```

**Проверка:** вызов из консоли должен вернуть `403 permission denied`.

---

#### 2. REVOKE `process_gamification_event`

Позволяет создавать фейковые события с начислением коинов.

```sql
REVOKE EXECUTE ON FUNCTION public.process_gamification_event(uuid, text, text, text, date, jsonb, text, integer, boolean)
  FROM PUBLIC, authenticated, anon;
```

---

#### 3. REVOKE всех `fn_award_*` функций

Функции начисления коинов за конкурсы — должны вызываться только VPS-скриптами.

```sql
REVOKE EXECUTE ON FUNCTION public.fn_award_department_contest() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.fn_award_revit_points() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.fn_award_revit_team_contest() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.fn_award_ws_dept_contest() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.fn_award_ws_team_contest() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.fn_award_gratitude_points_v2() FROM PUBLIC, authenticated, anon;
```

> `fn_award_gratitude_points_v2` — триггерная функция. Триггеры срабатывают независимо от EXECUTE-прав, поэтому INSERT в `gratitudes` продолжит работать.

---

#### 4. REVOKE внутренних системных функций

Cron-функции и админ-операции.

```sql
REVOKE EXECUTE ON FUNCTION public.fn_ach_snapshot_rankings() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.fn_refresh_ranking_views() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.fn_finalize_expired_ws_pendings() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.fn_ach_check_gratitude_achievements() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.draw_lottery_winner() FROM PUBLIC, authenticated, anon;
```

---

#### 5. REVOKE неиспользуемых READ-функций

Эти функции вызываются только через service_role сервер-сайд (`createSupabaseAdminClient`). Прямой REST API доступ им не нужен.

```sql
REVOKE EXECUTE ON FUNCTION public.get_gratitudes_feed(integer) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_gratitudes(text, integer) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.get_sender_quota(uuid) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.fn_ach_get_progress(uuid) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.fn_ach_get_gratitude_progress(uuid) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.my_ws_user_id() FROM PUBLIC, authenticated, anon;
```

> ⚠️ `current_crystal_rate()` **намеренно не трогаем** — используется в `streak-shield/queries.ts` через user auth (не service_role). REVOKE сломал бы страницу щитов. Данные несекретные (курс пересчёта).

---

### 🟡 Средний приоритет

#### 6. Скрыть черновики `help_articles` от обычных пользователей

Политика разрешает админам видеть всё, остальным — только опубликованные. Без правки кода — проверка `is_admin` идёт прямо в политике через JWT.

```sql
DROP POLICY IF EXISTS "help_articles_read" ON public.help_articles;

CREATE POLICY "help_articles_read" ON public.help_articles
  FOR SELECT TO authenticated USING (
    is_published = true
    OR COALESCE(((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean), false) = true
  );
```

**Проверка:** обычный пользователь не видит черновики через REST API, админ видит все.

---

#### 7. Удалить следы анонимных благодарностей

**Шаг 1 — пересоздать вьюху без `is_anonymous` и с `security_invoker`:**

```sql
DROP VIEW IF EXISTS public.v_gratitudes_feed_new;

CREATE VIEW public.v_gratitudes_feed_new
WITH (security_invoker = true) AS
SELECT
  g.id,
  g.type,
  g.gift_source,
  g.category,
  g.coins_amount,
  s.email AS sender_email,
  (s.first_name || ' ' || s.last_name) AS sender_name,
  s.department_code AS sender_department,
  r.email AS recipient_email,
  (r.first_name || ' ' || r.last_name) AS recipient_name,
  r.department_code AS recipient_department,
  g.message,
  g.created_at,
  COALESCE((
    SELECT t.coins
    FROM gamification_transactions t
    JOIN gamification_event_logs e ON e.id = t.event_id
    WHERE e.idempotency_key = ('gratitude_v2_' || g.id)
    LIMIT 1
  ), 0) AS earned_coins
FROM gratitudes g
JOIN ws_users s ON s.id = g.sender_id
JOIN ws_users r ON r.id = g.recipient_id
ORDER BY g.created_at DESC;
```

**Шаг 2 — удалить колонку:**

```sql
ALTER TABLE public.gratitudes DROP COLUMN is_anonymous;
```

> Вьюха используется только через service_role в `gratitudes/queries.ts` и `feed/queries.ts` — смена на `security_invoker` ничего не сломает.

---

#### 8. Добавить service_role политики на 6 таблиц без политик

RLS включён, политик нет — Supabase помечает как подозрительное. Это чисто косметическая правка: service_role обходит RLS и без политик, политика для `authenticated`/`anon` не создаётся → доступ для пользователей не меняется.

```sql
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ws_daily_reports', 'ws_task_actual_hours', 'ws_task_actual_hours_l2',
    'ws_task_budget_checkpoints', 'ws_task_percent_snapshots', 'ws_user_absences'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY "service_role_all" ON public.%I TO service_role USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;
```

---

#### 9. Включить защиту от утечки паролей

В Supabase Dashboard → Authentication → Sign In / Up → Password Protection → включить **"Check for leaked passwords"**.

Никакого SQL.

---

## Что отложено

| Пункт | Причина |
|-------|---------|
| Security Definer на 7 вьюхах (кроме `v_gratitudes_feed_new`) | Требует получить DDL каждой и пересоздать вручную |
| Function search_path mutable (~25 функций) | Может сломать функции если внутри есть имена без схемы — нужен индивидуальный разбор |
| Materialized View in API (рейтинги) | Намеренно публичные |
| Public Bucket Allows Listing | Нужно проверить использует ли UI листинг файлов |
| Performance: auth_rls_initplan | Только оптимизация, не безопасность |
| Duplicate/Unused Indexes | `lottery_draws_one_active` может быть unique constraint — отдельная проверка |
| Сброс тестовых 300 монет Александры | Разработчик, не критично |

---

## Порядок применения

1. Пункт 1 — REVOKE `increment_balance`
2. Пункт 2 — REVOKE `process_gamification_event`
3. Пункт 3 — REVOKE `fn_award_*` (6 функций)
4. Пункт 4 — REVOKE внутренних системных функций (5 функций)
5. Пункт 5 — REVOKE READ-функций (6 функций, **без `current_crystal_rate`**)
6. Пункт 6 — обновить политику `help_articles`
7. Пункт 7 — пересоздать вьюху `v_gratitudes_feed_new` + DROP `is_anonymous`
8. Пункт 8 — добавить service_role политики
9. Пункт 9 — включить защиту паролей в Dashboard

После каждого пункта — проверка что приложение работает.

---

## Гарантии безопасности кода

Все вызовы функций и таблиц в коде проверены:

| Объект | Где вызывается | Какой клиент |
|--------|----------------|--------------|
| `increment_balance` | нигде | — |
| `process_gamification_event` | только VPS | service_role |
| `fn_award_gratitude_points_v2` | триггер на `gratitudes` | (триггер) |
| `fn_award_*` остальные | VPS-скрипты | service_role |
| `fn_ach_*` cron | VPS-cron | service_role |
| `get_sender_quota` | gratitudes/queries.ts:80 | admin |
| `fn_ach_get_progress` | achievements/queries.ts:8 | admin |
| `fn_ach_get_gratitude_progress` | achievements/queries.ts:83 | admin |
| `v_gratitudes_feed_new` | gratitudes/queries.ts, feed/queries.ts | admin |
| `current_crystal_rate` | streak-shield/queries.ts:43 | **server (user auth)** → НЕ REVOKE |
| `help_articles` (read) | help/queries.ts:96, 107, 138 | server (user auth) → политика учитывает |
