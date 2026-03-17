# gamification-events

Логика начисления и списания баллов по каждому типу события.

---

## Общие правила

1. Все начисления — через `INSERT INTO gamification_event_logs` с `idempotency_key` и `ON CONFLICT (idempotency_key) DO NOTHING`. Дубль игнорируется без ошибки.
2. Резолвить email → `user_id` через `SELECT id FROM ws_users WHERE email = lower(?) AND is_active = true`. Если не найден — пропустить.
3. Суммы всегда читать из `gamification_event_types` — не хардкодить.
4. Стрики Revit обновляются в том же триггере сразу после вставки события.
5. После каждого события атомарно создаётся `gamification_transactions` и обновляется `gamification_balances`.

---

## Архитектура начислений

```
sync-at_gratitudes (edge fn, каждые 4 часа)
  → INSERT/UPDATE at_gratitudes
    → trg_award_gratitude_points (триггер)
      → fn_award_gratitude_points()
        → INSERT gamification_event_logs
        → INSERT gamification_transactions
        → UPSERT gamification_balances

sync-plugin-launches (edge fn, 1 раз/день)
  → INSERT/UPDATE elk_plugin_launches
    → trg_award_revit_points (триггер)
      → fn_award_revit_points()
        → INSERT gamification_event_logs
        → INSERT gamification_transactions
        → UPSERT gamification_balances
        → UPDATE revit_user_streaks

compute-gamification (edge fn, WS-часть — коллега, 1 раз/день)
  → вычисляет статусы по ws_daily_reports
    → INSERT gamification_event_logs (WS события)
    → INSERT gamification_transactions
    → UPSERT gamification_balances
    → UPDATE ws_user_streaks
```

---

## 1. Revit — использование плагинов

**Триггер:** `trg_award_revit_points` на `elk_plugin_launches` (`AFTER INSERT OR UPDATE`)
**Функция:** `fn_award_revit_points()` (`SECURITY DEFINER`)

### Зелёный день

**Условие:** любая запись в `elk_plugin_launches` с новым `(user_email, work_date)`
**Получатель:** сотрудник
**Сумма:** `revit_using_plugins` → **+5**

```
idempotency_key: revit_green_{email}_{work_date}
event_type:      revit_using_plugins
source:          revit
details:         { plugin_name, launch_count }
```

Один сотрудник за день имеет несколько строк в `elk_plugin_launches` (по одной на плагин). Зелёный день засчитывается один раз: `ON CONFLICT DO NOTHING` на idempotency_key.

### Стрик Revit

Обновляется в `fn_award_revit_points()` в `revit_user_streaks` сразу после успешного INSERT (проверяется через `GET DIAGNOSTICS v_row_count = ROW_COUNT`).

Непрерывность стрика проверяется с учётом **выходных и отсутствий**: считаются рабочие дни-пропуски между `last_green_date` и `work_date`, пропуская Сб/Вс и записи из `ws_user_absences`. Если пропусков нет → стрик продолжается.

| Условие | Действие |
|---|---|
| `last_green_date = work_date` | уже засчитан — пропустить |
| `is_frozen = true` | не трогать |
| между `last_green_date` и `work_date` нет рабочих пропусков | `current_streak + 1` |
| есть рабочие дни без запусков | `current_streak = 1` (стрик прерван) |

**Бонус за milestone:**

| current_streak | event_type | Сумма | idempotency_key |
|---|---|---|---|
| 7 | `revit_streak_7_bonus` | +25 | `revit_streak_7_{email}_{date}` |
| 30 | `revit_streak_30_bonus` | +100 | `revit_streak_30_{email}_{date}` |

---

## 2. Благодарности (Airtable)

**Триггер:** `trg_award_gratitude_points` на `at_gratitudes` (`AFTER INSERT OR UPDATE`)
**Функция:** `fn_award_gratitude_points()` (`SECURITY DEFINER`)

**Условие срабатывания:**
- При INSERT — всегда (если `deleted_in_airtable = false`)
- При UPDATE — только если изменился `deleted_in_airtable` или `airtable_status`. Простое обновление `synced_at` пропускается.

### Получатель

**Сумма:** `gratitude_recipient_points` → **+20**

```
idempotency_key: gratitude_recipient_{airtable_record_id}
event_type:      gratitude_recipient_points
source:          airtable
details:         { gratitude_id, sender_email }
```

**Edge cases:**
- Если `sender_email` или `recipient_email` не найден в `ws_users` — начисление пропускается.
- `deleted_in_airtable = true` — пропустить целиком.
- Email в `ws_users` хранятся в нижнем регистре. Airtable может присылать любой регистр — `lower()` в JOIN обязателен.

---

## 3. Worksection — ежедневный отчёт *(WS-часть — коллега)*

Реализуется через `compute-gamification`. Пишет в те же `gamification_event_logs`, `gamification_transactions`, `gamification_balances`. Типы событий: `green_day`, `red_day`, `ws_streak_7`, `ws_streak_30`, `ws_streak_90` и другие.

---

## 4. Worksection — бюджет задач *(WS-часть — коллега)*

Реализуется через `compute-gamification` + `budget_pending`. Типы событий: `budget_ok_l3`, `budget_ok_l2`, `budget_exceeded_l3`, `budget_exceeded_l2` и другие.

---

## 5. Командное соревнование по Revit *(не реализовано)*

```
idempotency_key: dept_top1_revit_{employee_id}_{YYYY-MM}
event_type:      team_contest_top1_bonus
Сумма:           team_contest_top1_bonus → +200
```

---

## 6. Магазин *(следующий этап)*

```
idempotency_key: purchase_{store_purchase_id}
event_type:      (определяется при реализации)
```

---

## 7. Ручные корректировки *(не реализовано — admin механизм не определён)*

Требует реализации admin-механизма проверки прав.

---

## Idempotency key — справочник (Revit + Gratitudes)

| Событие | Формат ключа |
|---|---|
| Revit зелёный день | `revit_green_{email}_{date}` |
| Revit стрик 7 дней | `revit_streak_7_{email}_{date}` |
| Revit стрик 30 дней | `revit_streak_30_{email}_{date}` |
| Благодарность получена | `gratitude_recipient_{airtable_id}` |

WS idempotency keys определяются коллегой в `compute-gamification`.

---

## Ограничения

- Если email из source-таблицы не найден в `ws_users` — событие молча пропускается.
- `at_gratitudes` с `deleted_in_airtable = true` — уже начисленные баллы не отзываются автоматически.
- Отрицательный баланс допустим. Запрещён только при покупке — проверяется в `create_purchase()`.
- Триггеры срабатывают на `UPDATE` тоже — idempotency_key защищает от повторных начислений при повторных синках.
- WS-часть создаётся коллегой через `compute-gamification` по тому же паттерну: event_logs → transactions → balances.
