# gamification-events

Логика начисления и списания 💎 по каждому типу события.

---

## Общие правила

1. Все события записываются в `gamification_event_logs` с `idempotency_key`. Дубли игнорируются (`ON CONFLICT DO NOTHING`).
2. Каждое событие с ненулевыми 💎 порождает ровно одну транзакцию в `gamification_transactions` (1:1 через `event_id` UNIQUE).
3. Баланс обновляется атомарно через inline UPSERT в `gamification_balances` (триггеры не используют RPC `increment_balance`).
4. Суммы 💎 читаются из `gamification_event_types` — не хардкодятся.
5. Резолвинг email → `ws_users.id`: `SELECT id FROM ws_users WHERE email = lower(?) AND is_active = true`. Если не найден — событие пропускается без ошибки.
6. VPS-скрипт `compute-gamification` использует атомарную SQL-функцию `process_gamification_event` — event + transaction + balance в одной PostgreSQL-транзакции. Защита от осиротевших записей при crash.

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
**💎:** `revit_using_plugins` → **+5**

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

| Условие                                                     | Действие                             |
| ----------------------------------------------------------- | ------------------------------------ |
| `last_green_date = work_date`                               | уже засчитан — пропустить            |
| `is_frozen = true`                                          | не трогать                           |
| между `last_green_date` и `work_date` нет рабочих пропусков | `current_streak + 1`                 |
| есть рабочие дни без запусков                               | `current_streak = 1` (стрик прерван) |

**Бонусы за milestones:**

| current_streak | event_type              | 💎   | idempotency_key                  |
| -------------- | ----------------------- | ---- | -------------------------------- |
| 7              | `revit_streak_7_bonus`  | +25  | `revit_streak_7_{email}_{date}`  |
| 30             | `revit_streak_30_bonus` | +100 | `revit_streak_30_{email}_{date}` |

---

## 2. Благодарности (Airtable)

**Механизм:** PG-триггер `trg_award_gratitude_points` на `at_gratitudes`

### Получатель

**💎:** `gratitude_recipient_points` → **+20**
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
- Уже начисленные 💎 за удалённые благодарности не отзываются автоматически
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

- Бюджет задачи расходуется (actual_hours прошёл чекпоинт 20/40/60/80/100/120/140/…, без верхней границы), но процент задачи не изменился
- Проверяется через `ws_task_budget_checkpoints` и `ws_task_percent_snapshots`
- Пропуск (проверка не запускается): `actual_hours === 0`
- Тихий upsert чекпоинта без нарушения: первое появление задачи в отслеживании; смена ассайни; падение `budget_percent` ниже прошлого чекпоинта (переоткрытие с увеличением `max_time`)
- Если ассайни L3 был в отпуске/на больничном — нарушение фиксируется, но L2-раздел **не** попадает в `section_red`

**Section discipline** (`section_red`):

- Руководитель раздела получает красный день, если у любого L3-исполнителя его раздела есть task dynamics violation
- details: `{ ws_task_id (L2), ws_task_name (L2), ws_project_id (L2), violations: [{ violator_email, ws_task_id (L3), ws_task_name (L3), ws_project_id (L3) }, ...], violation_type }`

### Стрик WS

Обновляется в `ws_user_streaks` скриптом `compute-gamification`, step 3.

**Подсчёт:** `current_streak = календарные дни от streak_start_date до вчера − дни отсутствий в этом диапазоне`. Выходные и праздники увеличивают стрик (календарные дни тикают). Отсутствия (отпуск, больничный, сик-дей) замораживают стрик — не увеличивают и не сбрасывают.

**Бонусы за milestones:**

| current_streak | event_type     | 💎   | idempotency_key                 |
| -------------- | -------------- | ---- | ------------------------------- |
| 7              | `ws_streak_7`  | +25  | `ws_streak_7_{user_id}_{date}`  |
| 30             | `ws_streak_30` | +100 | `ws_streak_30_{user_id}_{date}` |
| 90             | `ws_streak_90` | +300 | `ws_streak_90_{user_id}_{date}` |

---

## 4. Worksection — бюджет задач

**Механизм:** VPS-скрипт `compute-gamification`, steps 4-5

### Соблюдение бюджета (30-дневная задержка)

При закрытии задачи L3/L2 создаётся запись в `budget_pending` со статусом `pending` и `eligible_date = closed_at + 30 дней`.

По наступлению `eligible_date`:

- Если `actual_hours <= max_time` → `status = 'approved'`, начисление 💎
- Если задача переоткрыта или бюджет превышен → `status = 'revoked'`

### Ревизия approved (clawback)

Каждый прогон скрипта проверяет все approved записи — не превышен ли бюджет задним числом:

- **L3** (step 4d): если `actual_hours > max_time` → `budget_revoked_l3` исполнителю + `budget_revoked_l3_lead` тимлиду (если бонус был начислен)
- **L2** (step 4e): если суммарные часы (прямые + дочерние L3) > max_time → `budget_revoked_l2` руководителю

Сумма списания берётся из оригинальной транзакции начисления (`coins_override`), а не из справочника — гарантирует что списание всегда равно начислению.

### Мастер планирования

10 последовательных задач L3, закрытых в бюджете → бонусное событие `master_planner`.

---

## 5. Ежемесячные конкурсы отделов и команд

Четыре независимых конкурса. Победитель определяется 1-го числа каждого месяца в 22:00–22:03 UTC за предыдущий календарный месяц. Каждый активный сотрудник победившей сущности получает **+200 💎**.

Все функции защищены от пустого месяца: если `contest_score = 0` — никто не получает бонус.

---

### 5a. Revit — отдел

**Функция:** `fn_award_department_contest()` · cron `0 22 1 * *`

**Метрика:** `total_revit_coins × (users_earning / total_employees)` — учитывает вовлечённость отдела

```
event_type:      team_contest_top1_bonus
source:          contest
details:         { department, contest_month, contest_score }
idempotency_key: dept_top1_revit_{user_id}_{YYYY-MM}
```

**VIEW для UI:** `view_department_revit_contest` — текущий месяц, используется в `getDepartmentAutomationStats()`

---

### 5b. Revit — команда

**Функция:** `fn_award_revit_team_contest()` · cron `1 22 1 * *`

**Метрика:** `total_revit_coins × (users_earning / total_employees)` по команде

Исключены: `NULL`, `''`, `Вне команд*`, `Декретный`

```
event_type:      revit_team_contest_top1_bonus
source:          contest
details:         { team, contest_month, contest_score }
idempotency_key: team_top1_revit_{user_id}_{YYYY-MM}
```

---

### 5c. Worksection — отдел

**Функция:** `fn_award_ws_dept_contest()` · cron `2 22 1 * *`

**Метрика:** `total_ws_coins / total_employees` — среднее количество WS-монет на сотрудника

```
event_type:      ws_dept_contest_top1_bonus
source:          contest
details:         { department, contest_month, contest_score }
idempotency_key: dept_top1_ws_{user_id}_{YYYY-MM}
```

---

### 5d. Worksection — команда

**Функция:** `fn_award_ws_team_contest()` · cron `3 22 1 * *`

**Метрика:** `total_ws_coins / total_employees` по команде

Исключены: `NULL`, `''`, `Вне команд*`, `Декретный`

```
event_type:      ws_team_contest_top1_bonus
source:          contest
details:         { team, contest_month, contest_score }
idempotency_key: team_top1_ws_{user_id}_{YYYY-MM}
```

---

### VIEW для истории

`view_contest_monthly_winners` — один победитель на (event_type × contest_month). Читается в `getContestWinners()` (`src/modules/contests/`) для отображения в UI и в блоке `/admin/achievements`.

---

## 6. Магазин (не реализован)

Покупка товаров за 💎. Реализуется отдельно — модуль `shop` + event types `shop_purchase` / `shop_refund`.

---

## 7. Worksection — статус задачи при отчёте

**Механизм:** VPS-скрипт `compute-gamification`, step 1d

Если сотрудник залогировал трудозатраты (cost entry) на задачу L3, которая не находится в статусе «В работе», и задача ни разу не была «В работе» в течение этого дня — штраф -3 💎.

**«Презумпция невиновности»:** если задача хотя бы раз была в статусе «В работе» в течение дня (проверяется через `ws_task_status_changes` из get_events API), штраф не применяется.

NULL-статус (тег не установлен) = штраф.

Одна штрафная запись на комбинацию (user, task, day).

```
event_type:      wrong_status_report
source:          ws
details:         { ws_task_id, ws_task_name, ws_project_id, ws_task_url, task_status }
idempotency_key: wrong_status_{user_id}_{ws_task_id}_{date}
```

---

## 8. Worksection — закрытие в срок

**Механизм:** VPS-скрипт `compute-gamification`, step 4.5

При закрытии задачи L3 до или в дату `date_end` → +3 💎 после 30-дневного ожидания (аналогично бюджету).

- Если задача переоткрыта до проверки → pending-запись удаляется, повторное закрытие перезапускает 30-дневный отсчёт.
- Если задача переоткрыта после одобрения → clawback (`deadline_revoked_l3`, -3 💎).
- Задачи без `date_end` не участвуют.

```
event_type:      deadline_ok_l3 / deadline_revoked_l3
source:          ws
idempotency_key: deadline_ok_l3_{ws_task_id}_{user_id}
                 deadline_revoked_l3_{ws_task_id}_{user_id}
```

---

## Полный справочник event_type

Все типы зарегистрированы в `gamification_event_types` (38 строк).

**С начислением/списанием 💎:**

| event_type                   | 💎   | Источник | Механизм                              |
| ---------------------------- | ---- | -------- | ------------------------------------- |
| `master_planner`             | +450 | ws       | compute-gamification                  |
| `master_planner_l2`          | +400 | ws       | compute-gamification                  |
| `ws_streak_90`               | +300 | ws       | compute-gamification                  |
| `budget_ok_l2`               | +200 | ws       | compute-gamification                  |
| `team_contest_top1_bonus`    | +200 | contest  | PG-функция + pg_cron (1 число месяца) |
| `revit_streak_30_bonus`      | +100 | revit    | PG-триггер                            |
| `ws_streak_30`               | +100 | ws       | compute-gamification                  |
| `budget_ok_l3`               | +50  | ws       | compute-gamification                  |
| `revit_streak_7_bonus`       | +25  | revit    | PG-триггер                            |
| `ws_streak_7`                | +25  | ws       | compute-gamification                  |
| `gratitude_recipient_points` | +20  | airtable | PG-триггер                            |
| `revit_using_plugins`        | +5   | revit    | PG-триггер                            |
| `budget_ok_l3_lead_bonus`    | +5   | ws       | compute-gamification                  |
| `green_day`                  | +3   | ws       | compute-gamification                  |
| `deadline_ok_l3`             | +3   | ws       | compute-gamification                  |
| `wrong_status_report`        | -3   | ws       | compute-gamification                  |
| `deadline_revoked_l3`        | -3   | ws       | compute-gamification                  |
| `budget_revoked_l3_lead`     | -5   | ws       | compute-gamification                  |
| `budget_revoked_l3`          | -50  | ws       | compute-gamification                  |
| `budget_revoked_l2`          | -200 | ws       | compute-gamification                  |
| `master_planner_l2_revoked`  | -400 | ws       | compute-gamification                  |
| `master_planner_revoked`     | -450 | ws       | compute-gamification                  |

**Информационные (0 💎, фиксируют факт события):**

| event_type                  | Источник | Механизм             |
| --------------------------- | -------- | -------------------- |
| `red_day`                   | ws       | compute-gamification |
| `task_dynamics_violation`   | ws       | compute-gamification |
| `section_red`               | ws       | compute-gamification |
| `budget_exceeded_l3`        | ws       | compute-gamification |
| `budget_exceeded_l2`        | ws       | compute-gamification |
| `streak_reset_timetracking` | ws       | compute-gamification |
| `streak_reset_dynamics`     | ws       | compute-gamification |
| `streak_reset_section`      | ws       | compute-gamification |
| `streak_reset_wrong_status` | ws       | compute-gamification |
| `master_planner_reset`      | ws       | compute-gamification |
| `master_planner_l2_reset`   | ws       | compute-gamification |

---

## Idempotency key — справочник

**Revit (PG-триггеры):**

| Событие            | Формат ключа                     |
| ------------------ | -------------------------------- |
| Revit зелёный день | `revit_green_{email}_{date}`     |
| Revit стрик 7      | `revit_streak_7_{email}_{date}`  |
| Revit стрик 30     | `revit_streak_30_{email}_{date}` |

**Благодарности (PG-триггеры):**

| Событие                | Формат ключа                        |
| ---------------------- | ----------------------------------- |
| Благодарность получена | `gratitude_recipient_{airtable_id}` |

**WS — дневные статусы (compute-gamification):**

| Событие                        | Формат ключа                                    |
| ------------------------------ | ----------------------------------------------- |
| Зелёный день                   | `ws_green_day_{user_id}_{date}`                 |
| Красный день                   | `ws_red_day_{user_id}_{date}`                   |
| Нарушение динамики             | `ws_dynamics_{ws_task_id}_{checkpoint}`         |
| Дисциплина раздела             | `ws_section_red_{ws_l2_id}_{date}`              |
| Сброс стрика (таймтрекинг)     | `ws_streak_reset_tt_{user_id}_{date}`           |
| Сброс стрика (динамика)        | `ws_streak_reset_dyn_{user_id}_{date}`          |
| Сброс стрика (раздел)          | `ws_streak_reset_sec_{user_id}_{date}`          |
| Сброс стрика (неверный статус) | `ws_streak_reset_wrong_status_{user_id}_{date}` |

**WS — стрики (compute-gamification):**

| Событие     | Формат ключа                    |
| ----------- | ------------------------------- |
| WS стрик 7  | `ws_streak_7_{user_id}_{date}`  |
| WS стрик 30 | `ws_streak_30_{user_id}_{date}` |
| WS стрик 90 | `ws_streak_90_{user_id}_{date}` |

**WS — дедлайны (compute-gamification):**

| Событие             | Формат ключа                                 |
| ------------------- | -------------------------------------------- |
| Wrong status        | `wrong_status_{user_id}_{ws_task_id}_{date}` |
| Deadline OK L3      | `deadline_ok_l3_{ws_task_id}_{user_id}`      |
| Deadline revoked L3 | `deadline_revoked_l3_{ws_task_id}_{user_id}` |

**WS — бюджет (compute-gamification):**

| Событие             | Формат ключа                                  |
| ------------------- | --------------------------------------------- |
| Бюджет L3 ОК        | `budget_ok_l3_{ws_task_id}_{user_id}`         |
| Бюджет L2 ОК        | `budget_ok_l2_{ws_task_id}_{user_id}`         |
| Бюджет L3 превышен  | `budget_exceeded_l3_{ws_task_id}_{user_id}`   |
| Бюджет L2 превышен  | `budget_exceeded_l2_{ws_task_id}_{user_id}`   |
| Отзыв L3            | `budget_revoked_l3_{ws_task_id}_{user_id}`    |
| Отзыв L2            | `budget_revoked_l2_{ws_task_id}_{user_id}`    |
| Мастер планирования | `master_planner_{user_id}_{ws_task_id}`       |
| Сброс мастера       | `master_planner_reset_{user_id}_{ws_task_id}` |

**Другое:**

| Событие     | Формат ключа                          |
| ----------- | ------------------------------------- |
| Топ-1 отдел | `dept_top1_revit_{user_id}_{YYYY-MM}` |

---

## Ограничения

- `gamification_event_logs` + `gamification_transactions` — append-only, строки не удаляются
- Если email не найден в `ws_users` — событие молча пропускается
- `at_gratitudes` с `deleted_in_airtable = true` — начисленные 💎 не отзываются автоматически
- Баланс не уходит ниже 0: `process_gamification_event` clamp'ит штрафы/clawback до доступного, фактическая сумма пишется в `gamification_transactions` (см. `gamification-db.md`)
- Информационные события (red_day, violations, resets) имеют coins=0 в `gamification_event_types` — записываются в `gamification_event_logs`, но не создают транзакций в `gamification_transactions`
- `green_day` начисляет +3 💎 (обновлено миграцией 011)
- Триггеры срабатывают на UPDATE тоже — idempotency_key защищает от повторных начислений при повторных синках
- Благодарности: лимит 1 начисление от одного отправителя за `week_start` — проверяется в триггере через JOIN `gamification_event_logs` + `at_gratitudes`
