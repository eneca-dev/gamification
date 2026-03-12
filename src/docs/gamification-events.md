# gamification-events

Логика начисления и списания баллов по каждому типу события.

---

## Общие правила

1. Все начисления — через `INSERT INTO coin_transactions` с `idempotency_key` и `ON CONFLICT (idempotency_key) DO NOTHING`. Дубль игнорируется без ошибки.
2. Резолвить email → `employee_id` через `SELECT id FROM ws_users WHERE email = lower(?) AND is_active = true`. Если не найден — пропустить, не выбрасывать ошибку.
3. Суммы всегда читать из `event_coin_config` — не хардкодить.
4. Стрики обновляются в том же триггере сразу после вставки транзакции.

---

## Архитектура начислений

Начисления происходят **мгновенно через PostgreSQL-триггеры**, а не по крону:

```
sync-at_gratitudes (edge fn, по расписанию)
  → INSERT/UPDATE at_gratitudes
    → trg_award_gratitude_points (триггер)
      → fn_award_gratitude_points()
        → INSERT coin_transactions

sync-planning-freshness (edge fn, по расписанию)
  → INSERT/UPDATE work_planning_freshness
    → trg_award_planning_points (триггер)
      → fn_award_planning_points()
        → INSERT coin_transactions

sync-plugin-launches (edge fn, по расписанию)
  → INSERT/UPDATE elk_plugin_launches
    → trg_award_revit_points (триггер)
      → fn_award_revit_points()
        → INSERT coin_transactions + UPDATE streaks

sync-ws-daily-status (edge fn, WS-часть — коллега)
  → INSERT/UPDATE ws_daily_status
    → trg_award_ws_points (триггер — коллега создаёт)
      → fn_award_ws_points()
        → INSERT coin_transactions + UPDATE streaks
```

---

## 1. Revit — использование плагинов

**Триггер:** `trg_award_revit_points` на `elk_plugin_launches` (`AFTER INSERT OR UPDATE`)
**Функция:** `fn_award_revit_points()` (`SECURITY DEFINER`)

### Зелёный день

**Условие:** любая запись в `elk_plugin_launches` с новым `(user_email, work_date)`
**Получатель:** сотрудник
**Сумма:** `revit_green_day_points` → **+5**

```
idempotency_key: revit_green_{email}_{work_date}
event_type:      revit_green_day
source_type:     elk_plugin_launches
```

Один сотрудник за день может запустить несколько плагинов — несколько строк в `elk_plugin_launches`. Зелёный день засчитывается один раз: `ON CONFLICT DO NOTHING` на idempotency_key.

### Стрик Revit

Обновляется в `fn_award_revit_points()` сразу после успешного INSERT (проверяется через `GET DIAGNOSTICS v_row_count = ROW_COUNT`).

| Условие | Действие |
|---|---|
| `last_green_date = work_date - 1` | `current_streak + 1` |
| `last_green_date = work_date` | уже засчитан — пропустить |
| иначе | `current_streak = 1` (стрик прерван) |
| `is_frozen = true` | не трогать |

**Бонус за milestone:**

| current_streak | event_type | Сумма | idempotency_key |
|---|---|---|---|
| 7 | `revit_streak_bonus` | +25 | `revit_streak_7_{email}_{date}` |
| 30 | `revit_streak_bonus` | +100 | `revit_streak_30_{email}_{date}` |

---

## 2. Благодарности (Airtable)

**Триггер:** `trg_award_gratitude_points` на `at_gratitudes` (`AFTER INSERT OR UPDATE`)
**Функция:** `fn_award_gratitude_points()` (`SECURITY DEFINER`)

**Условие срабатывания:**
- При INSERT — всегда (если `deleted_in_airtable = false`)
- При UPDATE — только если изменился `deleted_in_airtable` или `airtable_status`. Простое обновление `synced_at` пропускается.

### Получатель

**Сумма:** `gratitude_recipient_points` → **+20**
**Ограничений нет** — начисляется за каждую благодарность.

```
idempotency_key: gratitude_recipient_{airtable_record_id}
event_type:      gratitude_received
source_type:     at_gratitudes
```

### Отправитель

**Сумма:** `gratitude_sender_points` → **+10**
**Лимит:** `gratitude_weekly_sender_cap` → **3 раза в неделю**

```
idempotency_key: gratitude_sender_{airtable_record_id}
event_type:      gratitude_sent
source_type:     at_gratitudes
```

Проверка лимита в функции:
```sql
SELECT COUNT(*) FROM coin_transactions
WHERE employee_id = v_sender_id
  AND event_type = 'gratitude_sent'
  AND is_cancelled = false
  AND created_at >= NEW.week_start::timestamptz
  AND created_at < (NEW.week_start::date + interval '7 days')::timestamptz
```

Если `count >= cap` — INSERT пропускается. Получатель при этом баллы получает всегда.

**Edge cases:**
- Если `sender_email` или `recipient_email` не найден в `ws_users` — соответствующее начисление пропускается, другое остаётся.
- `deleted_in_airtable = true` — пропустить целиком. Уже начисленные баллы не отзываются автоматически.
- Email в `ws_users` хранятся в нижнем регистре. Airtable может присылать любой регистр — `lower()` в JOIN обязателен.

---

## 3. Планирование eneca.work

**Триггер:** `trg_award_planning_points` на `work_planning_freshness` (`AFTER INSERT OR UPDATE`)
**Функция:** `fn_award_planning_points()` (`SECURITY DEFINER`)

Получатели: `team_lead_email` и `department_head_email` (если разные люди — оба получают).

### Бонус за актуализацию

**Условие:** `days_since_update <= 3` и `last_update IS NOT NULL`
**Сумма:** `planning_update_bonus` → **+30**

```
idempotency_key (тимлид):    planning_bonus_lead_{team_id}_{last_update::date}
idempotency_key (нач.отдела): planning_bonus_head_{department_id}_{last_update::date}
event_type:                  planning_bonus
source_type:                 work_planning_freshness
```

Ключ привязан к дате `last_update` — один бонус за каждое реальное обновление планирования. Повторный синк не создаёт дублей.

### Штраф за просрочку

**Условие:** `days_since_update > 7`
**Сумма:** `-planning_overdue_penalty` → **-30**
**Периодичность:** раз в 3 дня (ключ привязан к 3-дневному периоду)

```
idempotency_key (тимлид):    planning_penalty_lead_{team_id}_{3day_period}
idempotency_key (нач.отдела): planning_penalty_head_{department_id}_{3day_period}
event_type:                  planning_penalty
source_type:                 work_planning_freshness
```

Где `3day_period = floor(extract(epoch from current_date) / (3 * 86400))::bigint`.

**Edge cases:**
- Бонус и штраф взаимоисключают друг друга: `days_since_update <= 3` → бонус, `> 7` → штраф, `4..7` — ничего.
- Команды без `team_lead_email` или `department_head_email` — пропускаются.
- Один человек может быть тимлидом нескольких команд → получит бонус за каждую.

---

## 4. Worksection — ежедневный отчёт *(WS-часть — коллега)*

**Триггер:** `trg_award_ws_points` на `ws_daily_status` (создаётся коллегой)
**Функция:** `fn_award_ws_points()` (создаётся по образцу `fn_award_revit_points`)

### Зелёный день WS

**Условие:** `status = 'green'`
**Сумма:** `ws_green_day_points` → **+10**

```
idempotency_key: ws_green_{employee_id}_{status_date}
event_type:      ws_green_day
```

### Стрик WS

| Условие | Действие |
|---|---|
| `status = 'green'` | `current_streak + 1` |
| `status = 'red'` | `current_streak = 0`, `best_streak` сохраняется |
| `status = 'frozen'` | не трогать (`is_frozen = true`) |

Бонусы аналогичны Revit, но пороги: 7 / 30 / 90 дней, суммы: +50 / +200 / +500.

```
idempotency_key: ws_streak_7_{employee_id}_{date}
idempotency_key: ws_streak_30_{employee_id}_{date}
idempotency_key: ws_streak_90_{employee_id}_{date}
event_type:      ws_streak_bonus
```

---

## 5. Worksection — бюджет задач *(WS-часть — коллега)*

Логика начисления за соблюдение бюджета L3/L2 задач с 30-дневной задержкой. Реализуется через `ws_task_events` и `budget_awards_queue` — создаёт коллега.

Краткая схема:

```
ws_task_events (event_type='closed', budget_ok=true)
  → INSERT budget_awards_queue (pay_after = closed_at + 30 days)
    → compute-budget-awards (cron, ежедневно)
      → проверяет: не переоткрыта?, не архивирована?
        → INSERT coin_transactions (ws_executor_budget_bonus +50, ws_teamlead_l3_budget_bonus +10)

При переоткрытии после выплаты и превышении бюджета:
  → INSERT coin_transactions (clawback: -50, -10)
  → списывается с оригинального получателя (snapshot в budget_awards_queue)
```

Idempotency keys:
```
ws_budget_l3_{ws_task_id}_{employee_id}
ws_budget_l3_tl_{ws_task_id}_{employee_id}
ws_budget_l2_{ws_task_id}_{employee_id}
ws_budget_clawback_{ws_task_id}_{employee_id}_reopen_{N}
ws_planning_master_{employee_id}_{ws_task_id}
```

---

## 6. Командное соревнование по Revit *(не реализовано)*

Запускается 1-го числа месяца. Победитель — отдел с наибольшим % сотрудников, запускавших плагины.

```
idempotency_key: dept_top1_revit_{employee_id}_{YYYY-MM}
event_type:      team_contest_bonus
Сумма:           team_contest_top1_bonus → +200 каждому сотруднику отдела
```

---

## 7. Магазин *(этап 4 — не реализован)*

### Покупка

Только через RPC `create_purchase(product_id)`. Атомарная проверка баланса + списание.

```
idempotency_key: purchase_{store_purchase_id}
event_type:      store_purchase
amount:          -price_paid
```

### Вторая жизнь

RPC `activate_second_life(purchase_id, violation_date)`. Условия:
- Активация в течение 24 часов после нарушения
- Не более 1 раза в месяц (UNIQUE constraint в `second_life_activations`)

---

## 8. Ручные корректировки (admin)

**RPC:** `add_manual_adjustment(employee_id, amount, reason)`

```
idempotency_key: manual_{employee_id}_{epoch_timestamp}
event_type:      manual_adjustment
source_type:     admin
```

Пишет в `audit_log`. Только `is_admin() = true`.

---

## 9. Отмена транзакции (admin)

**RPC:** `cancel_transaction(transaction_id, reason)`

Выставляет `is_cancelled = true` на оригинальной транзакции, создаёт сторнирующую:

```
idempotency_key: cancel_{original_transaction_id}
event_type:      cancel_adjustment
amount:          -original_amount
parent_id:       original_transaction_id
```

Пишет в `audit_log`. Только `is_admin() = true`.

---

## Idempotency key — полный справочник

| Событие | Формат ключа |
|---|---|
| Revit зелёный день | `revit_green_{email}_{date}` |
| Revit стрик 7 дней | `revit_streak_7_{email}_{date}` |
| Revit стрик 30 дней | `revit_streak_30_{email}_{date}` |
| Благодарность получена | `gratitude_recipient_{airtable_id}` |
| Благодарность отправлена | `gratitude_sender_{airtable_id}` |
| Бонус планирования (тимлид) | `planning_bonus_lead_{team_id}_{last_update_date}` |
| Бонус планирования (нач.отдела) | `planning_bonus_head_{dept_id}_{last_update_date}` |
| Штраф планирования (тимлид) | `planning_penalty_lead_{team_id}_{3day_period}` |
| Штраф планирования (нач.отдела) | `planning_penalty_head_{dept_id}_{3day_period}` |
| WS зелёный день | `ws_green_{employee_id}_{date}` |
| WS стрик 7 дней | `ws_streak_7_{employee_id}_{date}` |
| WS стрик 30 дней | `ws_streak_30_{employee_id}_{date}` |
| WS стрик 90 дней | `ws_streak_90_{employee_id}_{date}` |
| Бюджет L3 — исполнитель | `ws_budget_l3_{ws_task_id}_{employee_id}` |
| Бюджет L3 — тимлид | `ws_budget_l3_tl_{ws_task_id}_{employee_id}` |
| Бюджет L2 — тимлид | `ws_budget_l2_{ws_task_id}_{employee_id}` |
| Clawback | `ws_budget_clawback_{ws_task_id}_{employee_id}_reopen_{N}` |
| Мастер планирования | `ws_planning_master_{employee_id}_{ws_task_id}` |
| Топ-1 отдел | `dept_top1_revit_{employee_id}_{YYYY-MM}` |
| Покупка | `purchase_{store_purchase_id}` |
| Отмена транзакции | `cancel_{original_tx_id}` |
| Ручная корректировка | `manual_{employee_id}_{epoch}` |

---

## Ограничения

- Если email из source-таблицы не найден в `ws_users` — событие молча пропускается. Начисление произойдёт при следующем срабатывании триггера если сотрудник появится в `ws_users`.
- `at_gratitudes` с `deleted_in_airtable = true` — уже начисленные баллы не отзываются автоматически. Только через admin `cancel_transaction`.
- Отрицательный баланс допустим (штрафы, clawback). Запрещён только при покупке — проверяется в `create_purchase()`.
- Триггеры срабатывают на `UPDATE` тоже — idempotency_key защищает от повторных начислений при повторных синках.
- WS-часть (зелёные дни, бюджеты, «Мастер планирования») создаётся коллегой по тому же паттерну что `fn_award_revit_points`.
