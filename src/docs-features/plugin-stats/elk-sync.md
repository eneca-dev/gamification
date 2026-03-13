# ELK → Supabase: Синхронизация данных плагинов

## Цель

Заменить моковые данные автоматизаций реальными из Elasticsearch.
Хранить дневные агрегаты в Supabase для истории и будущих фич (dept contest, ачивки).

## Определение готовности (DoD)

- [ ] Таблица `elk_plugin_launches` создана в Supabase
- [ ] Edge Function `sync-plugin-launches` синхронизирует вчерашний день по расписанию
- [ ] Бэкфилл 30 дней выполнен
- [ ] Стрик автоматизаций для текущего пользователя считается из Supabase (fallback → live ES)
- [ ] Лидерборд "Топ-5 Автоматизации" использует реальные данные с именами из profiles
- [ ] Документация `src/docs/plugin-stats.md` обновлена

---

## Этапы реализации

### Этап 1: Таблица `elk_plugin_launches` в Supabase

**Схема (одобрена db-architect):**

```sql
CREATE TABLE public.elk_plugin_launches (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_email   text        NOT NULL,
  work_date    date        NOT NULL,
  launch_count integer     NOT NULL,
  synced_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT elk_plugin_launches_pkey PRIMARY KEY (id),
  CONSTRAINT elk_plugin_launches_user_email_work_date_key UNIQUE (user_email, work_date),
  CONSTRAINT elk_plugin_launches_launch_count_positive CHECK (launch_count > 0)
);

CREATE INDEX idx_elk_plugin_launches_email_date ON public.elk_plugin_launches (user_email, work_date DESC);
CREATE INDEX idx_elk_plugin_launches_date ON public.elk_plugin_launches (work_date);

ALTER TABLE public.elk_plugin_launches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read elk_plugin_launches"
  ON public.elk_plugin_launches FOR SELECT TO authenticated USING (true);
```

**Затрагиваемые файлы:**
- Supabase migration (через MCP apply_migration)

---

### Этап 2: Supabase Edge Function `sync-plugin-launches`

Запускается по расписанию раз в день (Supabase Cron).
Делает GET вчерашнего дня из ES → upsert в `elk_plugin_launches`.

**Логика:**
1. Запрос к ES: события за вчерашний день (`Properties.IsEnecaUser: true`, `MessageTemplate: "App successfully started"`, range: вчера)
2. Агрегация: SUM по `Properties.Email.keyword` → `{ email, launch_count }`
3. Upsert в `elk_plugin_launches` через admin-клиент

**Бэкфилл:** отдельный вызов функции с параметром `?backfill=30` — запускает 30 итераций по дням.

**Затрагиваемые файлы:**
- `supabase/functions/sync-plugin-launches/index.ts` (новый)
- `.env.local` — переменные уже есть (`KIBANA_API_KEY`, `KIBANA_URL`)
- Supabase project: env vars `KIBANA_URL`, `KIBANA_API_KEY` (добавить в Supabase dashboard)

---

### Этап 3: Queries из Supabase в модуле plugin-stats

Новые функции в `src/modules/plugin-stats/queries.ts`:

- `getUserAutomationStreak(email)` — серия последовательных дней из `elk_plugin_launches`. Если таблица пустая → fallback на `getUserPluginDays()` из ES.
- `getTopAutomationUsers(limit)` — топ по суммарным запускам за 30 дней из `elk_plugin_launches`. Джойнит с `profiles` через `auth.users` для получения имён.

**Затрагиваемые файлы:**
- `src/modules/plugin-stats/queries.ts`
- `src/modules/plugin-stats/types.ts`
- `src/modules/plugin-stats/index.ts`

---

### Этап 4: Интеграция в UI

Заменить моковые данные в `src/app/page.tsx`:

- `worksectionStreak.automationCurrentDays` → из `getUserAutomationStreak(currentUser.email)`
- `worksectionStreak.calendarDays[].automation` → из той же функции (список дат)
- `revitEntries` (лидерборд таб 2) → из `getTopAutomationUsers(10)` с реальными именами

**Затрагиваемые файлы:**
- `src/app/page.tsx`
- `src/modules/plugin-stats/queries.ts` (из этапа 3)

---

## Зависимости между этапами

```
Этап 1 (таблица) → Этап 2 (Edge Function + бэкфилл) → Этап 3 (queries) → Этап 4 (UI)
```

## Что НЕ делаем сейчас (YAGNI)

- Department contest — ждём когда profiles будут заполнены у всех
- Per-plugin breakdown — не нужен для текущего UI
- Realtime-подписки на elk_plugin_launches — данные меняются раз в день
- `user_id` FK в таблице — резолвим email→UUID на уровне запросов
