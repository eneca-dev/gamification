# План: приведение событий геймификации в соответствие с бизнес-логикой

## Расхождения

1. `green_day` — сейчас 0 коинов, нужно +3
2. Нет события «бонус тимлиду L2 за закрытие дочерней L3 в бюджете» (+5)
3. Нет события «отзыв бонуса тимлиду L2 за L3» (−5)

---

## Шаг 1: Изменение стоимости green_day

**Что:** обновить `coins` у `green_day` в таблице `gamification_event_types` с 0 на 3.

**SQL-миграция:**
```sql
UPDATE gamification_event_types SET coins = 3, updated_at = now() WHERE key = 'green_day';
```

**Последствия:**
- `green_day` перестаёт быть информационным событием — теперь при его создании нужно также создавать запись в `gamification_transactions` и обновлять `gamification_balances`.
- Сейчас `compute-gamification` записывает `green_day` только в `gamification_event_logs` (без транзакции, т.к. coins = 0). Нужно изменить логику: если `coins != 0` — создавать транзакцию.
- **Ретроактивное начисление:** в `gamification_event_logs` уже есть исторические записи `green_day` без транзакций. Решить: начислять за прошлые дни или только с момента изменения.

**Файлы (VPS-скрипты, репозиторий gamification-vps-scripts):**
- `compute-gamification.ts` — шаг 6 (создание транзакций): убрать условие, которое пропускает события с 0 коинов, или явно проверять стоимость из `gamification_event_types`.

---

## Шаг 2: Новый тип события — бонус тимлиду L2 за L3 в бюджете

**Что:** добавить `budget_ok_l3_lead_bonus` (+5) в `gamification_event_types`.

**SQL-миграция:**
```sql
INSERT INTO gamification_event_types (key, coins, description)
VALUES ('budget_ok_l3_lead_bonus', 5, 'Бонус тимлиду L2 за закрытие дочерней L3 в бюджете');
```

**Логика в compute-gamification (шаг 4c — подошёл срок):**

При создании события `budget_ok_l3` для исполнителя — дополнительно:
1. Найти родительский L2 раздел через `ws_tasks_l3.parent_l2_id` → `ws_tasks_l2`.
2. Найти ответственного за L2 (`ws_tasks_l2.assignee_id`).
3. Если ответственный есть и отличается от исполнителя L3 — создать событие `budget_ok_l3_lead_bonus` для тимлида L2.

**Idempotency key:** `budget_ok_l3_lead_{ws_task_id}_{l2_assignee_id}`

**Файлы (VPS-скрипты):**
- `compute-gamification.ts` — шаг 4c: добавить создание бонусного события для тимлида.

---

## Шаг 3: Новый тип события — отзыв бонуса тимлиду L2 за L3

**Что:** добавить `budget_revoked_l3_lead` (−5) в `gamification_event_types`.

**SQL-миграция:**
```sql
INSERT INTO gamification_event_types (key, coins, description)
VALUES ('budget_revoked_l3_lead', -5, 'Отзыв бонуса тимлиду L2: бюджет дочерней L3 превышен после одобрения');
```

**Логика в compute-gamification (шаг 4d — ревизия approved):**

При создании события `budget_revoked_l3` для исполнителя — дополнительно:
1. Найти ответственного за родительский L2 (аналогично шагу 2).
2. Проверить, что ранее было создано событие `budget_ok_l3_lead_bonus` для этой задачи.
3. Если да — создать событие `budget_revoked_l3_lead` для тимлида L2.

**Idempotency key:** `budget_revoked_l3_lead_{ws_task_id}_{l2_assignee_id}`

**Файлы (VPS-скрипты):**
- `compute-gamification.ts` — шаг 4d: добавить создание события отзыва для тимлида.

---

## Шаг 4: Обновить документацию

- `src/docs/gamification-events.md` — добавить два новых типа событий, обновить coins у `green_day`.
- `src/docs/gamification-db.md` — обновить таблицу `gamification_event_types`, добавить idempotency keys.
- `src/docs-features/ws-gamification/plan.md` — обновить таблицу типов событий.

---

## Порядок выполнения

1. SQL-миграция: все три изменения в одной миграции (update green_day + insert два новых типа).
2. Обновить `compute-gamification.ts` в VPS-скриптах (шаги 4c, 4d, 6).
3. Решить вопрос с ретроактивным начислением за green_day.
4. Обновить документацию.

## Решения

1. **Ретроактивное начисление green_day:** нет. +3 коина начисляются только с момента применения миграции. Прошлые зелёные дни остаются без транзакций.
2. **Тимлид = исполнитель:** да, бонус +5 начисляется в любом случае, даже если ответственный за L2 и L3 — один и тот же человек.
