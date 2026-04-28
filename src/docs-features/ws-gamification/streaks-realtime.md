# Real-Time WS Streak Computation

## Цель

Перевести вычисление `current_streak` для WS на read-time расчёт через SQL-view, чтобы значение на панели соответствовало модели:

| День | Дельта |
|---|---|
| green | `+1` |
| red | триггерит pending; через 24ч (если щит не куплен) → сброс в 0 |
| отпуск / больничный / sick_day | `+0` (заморозка) |
| выходной (Сб/Вс / `calendar_holidays`) | `+1` |
| `calendar_workdays` (рабочая суббота) | как обычный рабочий день |

Текущее поведение скрипта (формула `calendar_days − absence_days` только в момент зелёного дня + скип выходных в vps + finalize pending только на следующем vps-прогоне) этой модели не соответствует — стрик «застывает» на старом значении до следующего рабочего дня и до следующего green.

## Семантика pending (зафиксировано)

- В течение 24ч после red — панель показывает прежнее значение `N` (как сейчас).
- Щит куплен в течение грейса → pending очищается, стрик продолжается с `N`.
- Грейс истёк без щита → стрик сбрасывается в `0`, и со **следующего дня** начинается новый счёт по дельтам (Сб red → 0 → Вс выходной → +1 → панель в Пн = 1).

## Definition of Done

- [ ] При просмотре панели в любое время суток (включая выходные и до утреннего vps-прогона) стрик отражает корректное значение под модель
- [ ] Pending истекает ровно через 24ч независимо от прогона vps (через `CASE WHEN expires_at > now()` в view, без cron)
- [ ] Выходные / праздники после finalized red day прибавляют +1 к нулю
- [ ] Milestone-события (`ws_streak_7/30/90`) выдаются ровно один раз при пересечении порога — обнаружение через сравнение «старое vs новое» при прогоне vps
- [ ] У Марии в Пн до прогона = `2`, у Антона = `1` (после ручной верификации, без правки данных)
- [ ] `npm run build` и `npm run lint` зелёные
- [ ] `src/docs/streak-panel.md` обновлён под новую логику

## Архитектура

```
┌─────────────────────────────────────────────────┐
│  ws_user_streaks (таблица)                      │
│  • current_streak — снапшот на момент vps-run   │
│  • streak_start_date, longest_streak,           │
│    completed_cycles, pending_reset_*            │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│  ws_user_streaks_effective (VIEW)               │
│  • walk от streak_start_date до today−1         │
│  • дельты по статусам / отсутствиям / календарю │
│  • CASE на pending — грейс или computed         │
│  • current_streak в view = ПРАВДА СЕЙЧАС        │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│  Чтение в queries.ts → панель                   │
└─────────────────────────────────────────────────┘
```

VPS-скрипт продолжает писать в таблицу, но milestone-detection теперь сравнивает значение из таблицы (prev) с values из view (next).

## Этапы реализации

### Этап 1 — SQL view + переключение чтения + документация (один коммит)

**Файлы:**
- `supabase/migrations/<NNN>_ws_user_streaks_effective_view.sql` — создание view
- `src/modules/streak-panel/queries.ts` — `_getWsStreakData()` читает из view вместо таблицы
- `src/docs/streak-panel.md` — переписать раздел «Логика работы» и «Ограничения» под read-time через view

**View `ws_user_streaks_effective`:**
- Walk-окно: от `streak_start_date` (если не null) до `current_date − 1`
- Если `streak_start_date IS NULL` и `pending_reset_date IS NOT NULL` → walk от `pending_reset_date + 1` до `current_date − 1` (новый стрик после finalize, начавшийся с дня после red — т.е. может стартовать на выходном)
- Если оба null → `computed = 0`
- Дельты:
  - `ws_daily_statuses.status = 'green'` → `+1`
  - `ws_daily_statuses.status = 'absent'` → `+0`
  - `ws_daily_statuses.status = 'red'` → `+0` (защитный fallback; в норме сюда не попадаем — start_date/pending_reset_date уже сдвинуты за red)
  - Нет строки в `ws_daily_statuses` за дату → `+1` (выходной/праздник/`calendar_workdays`-без-данных)
- Pending grace:
  ```sql
  CASE
    WHEN pending_reset_expires_at IS NOT NULL
         AND pending_reset_expires_at > now()
    THEN s.current_streak     -- замороженное значение во время грейса
    ELSE COALESCE(SUM(delta), 0)
  END AS current_streak
  ```
- Возвращаемые поля: `user_id, current_streak, longest_streak, completed_cycles, streak_start_date, pending_reset_date, pending_reset_expires_at`

**TS-сторона:**
```ts
const { data } = await supabase
  .from('ws_user_streaks_effective')
  .select('current_streak, longest_streak, completed_cycles, streak_start_date')
  .eq('user_id', userId)
  .maybeSingle()
```

Тип `WsStreakData` не меняется — поля те же, только источник другой.

### Этап 2 — VPS: упростить streak-логику и переключить milestone-detection

**Файлы:**
- `gamification-vps-scripts/src/scripts/compute-gamification.ts` — функция `updateStreaks()`

**Что меняется в скрипте:**

1. **Phase 1 (finalize unresolved pendings)** — почти без изменений. Единственное: при finalize установить `streak_start_date = pending_reset_date + 1 day` **не нужно**, потому что view сам учитывает кейс «start_date null + pending_reset_date есть» через fallback на `pending_reset_date + 1`. Оставляем `streak_start_date = null` как сейчас.

   _Замечание Pragmatic Architect: альтернатива (set start_date forward) перегружает семантику поля. Read-time fallback в view проще._

2. **Phase 2 (обработка вчерашнего дня)** — green-ветка упрощается:
   - **Убираем** формулу `current_streak = calendar_days − absence_days` (compute-gamification.ts:614-624)
   - **Оставляем** установку `streak_start_date = yesterdayIso` если null (первый зелёный после reset)
   - **Заменяем** milestone-check: вместо `if ([7, 30].includes(current_streak))` теперь читаем `effective.current_streak` из view, сравниваем с `prev_current_streak` из таблицы:
     ```ts
     const { data: effective } = await supabase
       .from('ws_user_streaks_effective')
       .select('current_streak')
       .eq('user_id', user.id)
       .maybeSingle()
     const next = effective?.current_streak ?? 0
     for (const T of [7, 30, 90]) {
       if (prev < T && T <= next) {
         events.push({ event_type: `ws_streak_${T}`, ... })
       }
     }
     streak.current_streak = next  // обновляем кэш в таблице
     ```
   - **90-дневный цикл (`completed_cycles`):** если `next >= 90` — инкрементить `completed_cycles`, ставить `streak_start_date = null`, `current_streak = 0`. Логика та же, просто значение приходит из view, а не из формулы.

3. **Red-ветка** — без изменений (ставим pending как сейчас).

**Что в скрипте остаётся как есть:**
- Скип выходных/праздников в начале (`if (isWeekend && !workday) return`)
- Расчёт зелёного/красного статуса дня
- Запись в `ws_daily_statuses`
- Phase 1 finalize unresolved pendings

## Риски и заметки

- **Расхождение `ws_user_streaks.current_streak` ↔ view между прогонами vps.** Таблица обновляется только в момент vps-прогона. Между прогонами (включая выходные) view даёт более актуальное значение. Это **ожидаемо** — таблица служит снапшотом для сравнения порогов milestone, а не источником истины для отображения. Любой код, читающий стрик «для пользователя», должен читать view, а не таблицу. Проверить всех читателей `ws_user_streaks.current_streak` и переключить на view (в плане Этапа 1 — grep по кодовой базе).

- **Производительность view.** ~600 юзеров × walk до 90 дней = 54k строк. Существующий индекс на `ws_daily_statuses (user_id, date)` (миграция 002) этого хватит. Кэш TanStack 5 минут уже есть. Если станет медленно — материализуем, но сейчас YAGNI.

- **Milestone-дубликаты** защищены `idempotency_key = ws_streak_<T>_<userId>_<yesterdayIso>` — повторный emit на ту же дату — no-op в `process_gamification_event`.

- **Revit стрики из скоупа исключаем** — у них другая триггерная логика и семантика gap_days. Если будем переделывать — отдельная фича.

## План коммитов

1. `feat(streak-panel): real-time streak via SQL view` — этап 1 (миграция + queries.ts + docs)
2. `feat(streaks): switch milestone detection to view-based comparison` — этап 2 (vps-скрипт)
