# gamification-events

Логика начисления и списания баллов по каждому типу события.

---

## Общие правила

1. Все события записываются в `gamification_event_logs` с `idempotency_key`. Дубли игнорируются (`ON CONFLICT DO NOTHING`).
2. Каждое событие с ненулевыми коинами порождает ровно одну транзакцию в `gamification_transactions` (1:1 через `event_id` UNIQUE).
3. Баланс обновляется атомарно через inline UPSERT в `gamification_balances` (триггеры не используют RPC `increment_balance`).
4. Суммы коинов читаются из `gamification_event_types` — не хардкодятся.
5. Резолвинг email → `ws_users.id`: `SELECT id FROM ws_users WHERE email = lower(?) AND is_active = true`. Если не найден — событие пропускается без ошибки.

---

## Архитектура начислений

Два параллельных механизма:

```
== Поток 1: PG-триггеры (мгновенно при синке) ==

sync-plugin-launches (pg_cron, 01:00 UTC)
  → UPSERT elk_plugin_launches
    → trg_award_revit_points
      → fn_award_revit_points()
        → INSERT gamification_event_logs + gamification_transactions
        → UPSERT gamification_balances (inline)
        → UPDATE revit_user_streaks

sync-gratitudes (pg_cron, каждые 4 часа)
  → UPSERT at_gratitudes
    → trg_award_gratitude_points
      → fn_award_gratitude_points()
        → INSERT gamification_event_logs + gamification_transactions
        → UPSERT gamification_balances (inline)

== Поток 2: VPS-скрипт compute-gamification (после синка WS-данных) ==

orchestrator.ts → compute-gamification.ts:
  Step 1: Violations (timetracking, task dynamics, section discipline)
  Step 2: Day status (green/red/absent)
  Step 3: Streaks (ws_user_streaks: current/longest, milestones 7/30/90)
  Step 4: Budget (budget_pending: pending→approved/revoked)
  Step 5: Master planner (10 consecutive budget_ok_l3)
  Step 6: Transactions → gamification_event_logs + gamification_transactions + gamification_balances
```

---

## 1. Revit — использование плагинов

**Механизм:** PG-триггер `trg_award_revit_points` на `elk_plugin_launches`

### Зелёный день Revit

**Условие:** запись в `elk_plugin_launches` с (user_email, work_date)
**Получатель:** сотрудник
**Коины:** `revit_using_plugins` → **+5**

```
event_type:      revit_using_plugins
source:          revit
details:         { plugin_name, launch_count }
idempotency_key: revit_green_{email}_{work_date}
```

Один сотрудник может запустить несколько плагинов за день (несколько строк). Зелёный день засчитывается один раз — дубли блокируются idempotency_key.

### Стрик Revit

Обновляется в `fn_award_revit_points()` в `revit_user_streaks` сразу после успешного INSERT (проверяется через `GET DIAGNOSTICS v_row_count = ROW_COUNT`).

Непрерывность стрика проверяется с учётом **выходных и отсутствий**: считаются рабочие дни-пропуски между `last_green_date` и `work_date` через `generate_series`, пропуская Сб/Вс (`dow IN (0,6)`) и записи из `ws_user_absences`. Если пропусков нет → стрик продолжается.

| Условие | Действие |
|---|---|
| `last_green_date = work_date` | уже засчитан — пропустить |
| `is_frozen = true` | не трогать |
| между `last_green_date` и `work_date` нет рабочих пропусков | `current_streak + 1` |
| есть рабочие дни без запусков | `current_streak = 1` (стрик прерван) |

**Бонусы за milestones:**

| current_streak | event_type | Коины | idempotency_key |
|---|---|---|---|
| 7 | `revit_streak_7_bonus` | +25 | `revit_streak_7_{email}_{date}` |
| 30 | `revit_streak_30_bonus` | +100 | `revit_streak_30_{email}_{date}` |

---

## 2. Благодарности (Airtable)

**Механизм:** PG-триггер `trg_award_gratitude_points` на `at_gratitudes`

### Получатель

**Коины:** `gratitude_recipient_points` → **+20**
**Лимит:** 1 начисление от одного `sender_email` за `week_start`. Если от этого отправителя уже есть запись в `gamification_event_logs` с `event_type = 'gratitude_recipient_points'` за ту же `week_start` — начисление пропускается.

```
event_type:      gratitude_recipient_points
source:          airtable
details:         { gratitude_id, sender_email }
idempotency_key: gratitude_recipient_{airtable_record_id}
```

### Условия срабатывания триггера

Триггер срабатывает на INSERT и UPDATE. На UPDATE — только если изменились `deleted_in_airtable` или `airtable_status`. Это предотвращает повторные начисления при обычных re-sync.

### Edge cases

- `sender_email` или `recipient_email` = NULL → начисление пропускается
- `sender_email` или `recipient_email` не найден в `ws_users` (is_active=true) → начисление пропускается
- `deleted_in_airtable = true` → пропускается целиком
- Уже начисленные баллы за удалённые благодарности не отзываются автоматически
- Email в `ws_users` хранятся в нижнем регистре. Airtable может присылать любой регистр — `lower()` в JOIN обязателен

---

## 3. Worksection — таймтрекинг

**Механизм:** VPS-скрипт `compute-gamification`, step 1-2

### Зелёный/красный день WS

Определяется по наличию записи в `ws_daily_reports` за дату:
- **Есть отчёт** → `green` (зелёный день)
- **Нет отчёта** → `red` (красный день, событие `red_day`)
- **Есть запись в `ws_user_absences`** → `absent` (пропуск, стрик не ломается)

View `view_daily_statuses` агрегирует эту логику.

### Нарушения (violations)

**Task dynamics violation** (`task_dynamics_violation`):
- Бюджет задачи расходуется (actual_hours прошёл чекпоинт 20/40/60/80/100%), но процент задачи не изменился
- Проверяется через `ws_task_budget_checkpoints` и `ws_task_percent_snapshots`

**Section discipline** (`section_red`):
- Руководитель раздела получает красный день, если у любого L3-исполнителя его раздела есть task dynamics violation

### Стрик WS

Обновляется в `ws_user_streaks` скриптом `compute-gamification`, step 3.

**Бонусы за milestones:**

| current_streak | event_type | Коины | idempotency_key |
|---|---|---|---|
| 7 | `ws_streak_7` | +25 | `ws_streak_7_{user_id}_{date}` |
| 30 | `ws_streak_30` | +100 | `ws_streak_30_{user_id}_{date}` |
| 90 | `ws_streak_90` | +300 | `ws_streak_90_{user_id}_{date}` |

---

## 4. Worksection — бюджет задач

**Механизм:** VPS-скрипт `compute-gamification`, steps 4-5

### Соблюдение бюджета (30-дневная задержка)

При закрытии задачи L3/L2 создаётся запись в `budget_pending` со статусом `pending` и `eligible_date = closed_at + 30 дней`.

По наступлению `eligible_date`:
- Если `actual_hours <= max_time` → `status = 'approved'`, начисление коинов
- Если задача переоткрыта или бюджет превышен → `status = 'revoked'`

### Мастер планирования

10 последовательных задач L3, закрытых в бюджете → бонусное событие `master_planner`.

---

## 5. Командное соревнование по Revit

**Механизм:** PG-функция `fn_award_department_contest()`, запускается pg_cron 1 числа каждого месяца в 02:00 UTC.

**Метрика:** сумма ревит-баллов (`source = 'revit'`) по отделу за прошлый календарный месяц. Отдел с максимальной суммой = победитель.

**Получатель:** каждый активный сотрудник отдела-победителя.
**Коины:** `team_contest_top1_bonus` → **+200**

```
event_type:      team_contest_top1_bonus
source:          contest
details:         { department, contest_month, department_coins }
idempotency_key: dept_top1_revit_{user_id}_{YYYY-MM}
```

**VIEW для UI:** `view_department_revit_contest` — сумма ревит-баллов по отделам за текущий месяц. Используется в `getDepartmentAutomationStats()` для отображения рейтинга на дашборде.

---

## 6. Магазин (не реализован)

Покупка артефактов за коины. `second_life_cost = -500` — сброс красного дня.

---

## Полный справочник event_type

Все типы зарегистрированы в `gamification_event_types` (24 строки).

**С начислением/списанием коинов:**

| event_type | Коины | Источник | Механизм |
|---|---|---|---|
| `master_planner` | +450 | ws | compute-gamification |
| `ws_streak_90` | +300 | ws | compute-gamification |
| `budget_ok_l2` | +200 | ws | compute-gamification |
| `team_contest_top1_bonus` | +200 | contest | PG-функция + pg_cron (1 число месяца) |
| `revit_streak_30_bonus` | +100 | revit | PG-триггер |
| `ws_streak_30` | +100 | ws | compute-gamification |
| `budget_ok_l3` | +50 | ws | compute-gamification |
| `revit_streak_7_bonus` | +25 | revit | PG-триггер |
| `ws_streak_7` | +25 | ws | compute-gamification |
| `gratitude_recipient_points` | +20 | airtable | PG-триггер |
| `revit_using_plugins` | +5 | revit | PG-триггер |
| `budget_revoked_l3` | -50 | ws | compute-gamification |
| `budget_revoked_l2` | -200 | ws | compute-gamification |
| `second_life_cost` | -500 | shop | не реализовано |

**Информационные (0 коинов, фиксируют факт события):**

| event_type | Источник | Механизм |
|---|---|---|
| `green_day` | ws | compute-gamification |
| `red_day` | ws | compute-gamification |
| `task_dynamics_violation` | ws | compute-gamification |
| `section_red` | ws | compute-gamification |
| `budget_exceeded_l3` | ws | compute-gamification |
| `budget_exceeded_l2` | ws | compute-gamification |
| `streak_reset_timetracking` | ws | compute-gamification |
| `streak_reset_dynamics` | ws | compute-gamification |
| `streak_reset_section` | ws | compute-gamification |
| `master_planner_reset` | ws | compute-gamification |

---

## Idempotency key — справочник

**Revit (PG-триггеры):**

| Событие | Формат ключа |
|---|---|
| Revit зелёный день | `revit_green_{email}_{date}` |
| Revit стрик 7 | `revit_streak_7_{email}_{date}` |
| Revit стрик 30 | `revit_streak_30_{email}_{date}` |

**Благодарности (PG-триггеры):**

| Событие | Формат ключа |
|---|---|
| Благодарность получена | `gratitude_recipient_{airtable_id}` |

**WS — дневные статусы (compute-gamification):**

| Событие | Формат ключа |
|---|---|
| Зелёный день | `ws_green_day_{user_id}_{date}` |
| Красный день | `ws_red_day_{user_id}_{date}` |
| Нарушение динамики | `ws_dynamics_{ws_task_id}_{checkpoint}` |
| Дисциплина раздела | `ws_section_red_{ws_l2_id}_{date}` |
| Сброс стрика (таймтрекинг) | `ws_streak_reset_tt_{user_id}_{date}` |
| Сброс стрика (динамика) | `ws_streak_reset_dyn_{user_id}_{date}` |
| Сброс стрика (раздел) | `ws_streak_reset_sec_{user_id}_{date}` |

**WS — стрики (compute-gamification):**

| Событие | Формат ключа |
|---|---|
| WS стрик 7 | `ws_streak_7_{user_id}_{date}` |
| WS стрик 30 | `ws_streak_30_{user_id}_{date}` |
| WS стрик 90 | `ws_streak_90_{user_id}_{date}` |

**WS — бюджет (compute-gamification):**

| Событие | Формат ключа |
|---|---|
| Бюджет L3 ОК | `budget_ok_l3_{ws_task_id}_{user_id}` |
| Бюджет L2 ОК | `budget_ok_l2_{ws_task_id}_{user_id}` |
| Бюджет L3 превышен | `budget_exceeded_l3_{ws_task_id}_{user_id}` |
| Бюджет L2 превышен | `budget_exceeded_l2_{ws_task_id}_{user_id}` |
| Отзыв L3 | `budget_revoked_l3_{ws_task_id}_{user_id}` |
| Отзыв L2 | `budget_revoked_l2_{ws_task_id}_{user_id}` |
| Мастер планирования | `master_planner_{user_id}_{ws_task_id}` |
| Сброс мастера | `master_planner_reset_{user_id}_{ws_task_id}` |

**Другое:**

| Событие | Формат ключа |
|---|---|
| Топ-1 отдел | `dept_top1_revit_{user_id}_{YYYY-MM}` |

---

## Ограничения

- `gamification_event_logs` + `gamification_transactions` — append-only, строки не удаляются
- Если email не найден в `ws_users` — событие молча пропускается
- `at_gratitudes` с `deleted_in_airtable = true` — начисленные баллы не отзываются автоматически
- Отрицательный баланс допустим (штрафы, clawback). Запрет только при покупке (будущий этап)
- Информационные события (green_day, red_day, violations, resets) имеют coins=0 в `gamification_event_types` — записываются в `gamification_event_logs`, но не создают транзакций в `gamification_transactions`
- Триггеры срабатывают на UPDATE тоже — idempotency_key защищает от повторных начислений при повторных синках
- Благодарности: лимит 1 начисление от одного отправителя за `week_start` — проверяется в триггере через JOIN `gamification_event_logs` + `at_gratitudes`
