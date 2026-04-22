# Система достижений — план реализации

> Дата: 2026-03-20
> Статус: Проектирование (ожидают ответы на вопросы)

## 1. Scope первой версии

### Делаем сейчас

- Revit-достижения (3 шт)
- Благодарности без категорий (2 шт из 3)
- Автоматический dry_run + ручное подтверждение из админки

### НЕ делаем

- Worksection-достижения (отложено)
- "Наставничество" (нет категории благодарностей в Airtable)

---

## 2. Достижения первой версии (5 штук)

### Revit — Техническая эффективность

| ID                     | Название              | Scope      | Условие                                           | Бонус                  |
| ---------------------- | --------------------- | ---------- | ------------------------------------------------- | ---------------------- |
| `ach_revit_leader`     | Лидер автоматизации   | individual | Топ-1 по **💎** за Revit за квартал               | 2000 💎                |
| `ach_revit_team`       | Технологичная команда | team       | Топ-1 команда по среднему кол-ву 💎 на сотрудника | +500 каждому в команде |
| `ach_revit_department` | Цифровой авангард     | department | Топ-1 отдел по % вовлечённости в автоматизации    | Пицца / 💎 на отдел    |

**Призы:**

- Лидер автоматизации: Кастомная 3D-статуэтка параметрической формы
- Технологичная команда: Переходящий настольный тотем/кубок тимлиду
- Цифровой авангард: Большой переходящий кубок отдела

### Корпоративная культура — Благодарности

| ID                    | Название                         | Scope      | Условие                                                  | Бонус   |
| --------------------- | -------------------------------- | ---------- | -------------------------------------------------------- | ------- |
| `ach_culture_support` | Поддержка коллег                 | individual | Топ-1 по количеству полученных благодарностей за квартал | 1000 💎 |
| `ach_culture_cross`   | Межфункциональное взаимодействие | individual | Благодарности от 3+ разных отделов за квартал            | 600 💎  |

**Призы:**

- Поддержка коллег: Стеклянная стела с гравировкой «Сердце команды»
- Межфункциональное взаимодействие: Power Bank с покрытием софт-тач и логотипом

---

## 3. Отложенные достижения (Worksection — реализация позже)

| ID                   | Название               | Scope      | Условие                                             | Бонус        |
| -------------------- | ---------------------- | ---------- | --------------------------------------------------- | ------------ |
| `ach_ws_discipline`  | Эталонная дисциплина   | individual | 0 красных дней за 12 месяцев                        | 1000 💎      |
| `ach_ws_team`        | Эффективное управление | team       | Команда с min % красных дней за квартал             | 1500 тимлиду |
| `ach_ws_department`  | Образцовый отдел       | department | Отдел с min % красных дней за квартал               | 2000 НО      |
| `ach_culture_mentor` | Наставничество         | individual | 5+ благодарностей в категории "Обучение/Менторство" | 1200 💎      |

---

## 4. Именование таблиц

Паттерн именования в БД по группам:

- `ws_*` — Worksection
- `gamification_*` — ядро геймификации
- `elk_*` — Elasticsearch
- `at_*` — Airtable
- `revit_*` — Revit
- **`ach_*` — достижения** (новое)

Таблицы:

```
ach_definitions      — справочник достижений
ach_evaluations      — журнал проверок (dry_run → awaiting → approved)
ach_awards           — факт выдачи конкретному человеку
```

---

## 5. Схема таблиц

### `ach_definitions` — справочник достижений

```sql
CREATE TABLE ach_definitions (
  id               text PRIMARY KEY,          -- 'ach_revit_leader'
  area             text NOT NULL,             -- 'revit' | 'culture'
  scope            text NOT NULL,             -- 'individual' | 'team' | 'department'
  name             text NOT NULL,             -- 'Лидер автоматизации'
  description      text,                      -- условие получения
  prize_description text,                     -- 'Кастомная 3D-статуэтка'
  bonus_coins      integer NOT NULL,          -- 2000
  period           text NOT NULL,             -- 'quarter' | 'year'
  is_active        boolean DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),

  CHECK (area IN ('revit', 'culture', 'worksection')),
  CHECK (scope IN ('individual', 'team', 'department')),
  CHECK (period IN ('quarter', 'year'))
);
```

### `ach_evaluations` — журнал проверок (полная прозрачность)

```sql
CREATE TABLE ach_evaluations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_id       text NOT NULL REFERENCES ach_definitions(id),
  period_start         date NOT NULL,           -- '2026-01-01'
  period_end           date NOT NULL,           -- '2026-03-31'
  evaluated_at         timestamptz DEFAULT now(),
  status               text NOT NULL DEFAULT 'awaiting_approval',
  approved_by          uuid REFERENCES auth.users(id),
  approved_at          timestamptz,

  -- Результаты
  winner_entity_type   text,                    -- 'user' | 'team' | 'department'
  winner_entity_id     text,                    -- email / team name / department name
  winner_value         numeric,                 -- метрика победителя (367 💎, 95% и т.д.)
  runner_up_entity_id  text,
  runner_up_value      numeric,
  all_candidates       jsonb,                   -- [{entity, value, rank}, ...]
  notes                text,                    -- комментарий (причина отказа и т.д.)

  CHECK (status IN ('dry_run', 'awaiting_approval', 'approved', 'rejected', 'failed')),
  UNIQUE (achievement_id, period_start)         -- одна проверка на достижение за период
);
```

**Ключевое**: `all_candidates` содержит полный рейтинг всех кандидатов.
Открываешь evaluation — видишь: кто первый, кто второй, с какими цифрами, когда проверялось, кто подтвердил.

### `ach_awards` — факт выдачи

```sql
CREATE TABLE ach_awards (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_id   text NOT NULL REFERENCES ach_definitions(id),
  evaluation_id    uuid NOT NULL REFERENCES ach_evaluations(id),
  user_id          uuid NOT NULL REFERENCES ws_users(id),
  user_email       text NOT NULL,
  role             text NOT NULL,              -- 'winner' | 'team_member' | 'team_lead' | 'dept_head'
  entity_name      text,                       -- 'Команда BIM-КР' (для командных)
  event_id         uuid REFERENCES gamification_event_logs(id),  -- связь с начислением 💎
  period_start     date NOT NULL,
  period_end       date NOT NULL,
  awarded_at       timestamptz DEFAULT now(),

  CHECK (role IN ('winner', 'team_member', 'team_lead', 'dept_head')),
  UNIQUE (achievement_id, user_id, period_start)  -- нельзя получить дважды за период
);
```

---

## 6. Интеграция с gamification_event_logs / transactions

💎 за достижения попадают в существующую систему логов и транзакций.

### Новые event_types (добавить в `gamification_event_types`)

```
ach_revit_leader       | 2000 | Достижение: Лидер автоматизации
ach_revit_team         | 500  | Достижение: Технологичная команда (на сотрудника)
ach_revit_department   | ???  | Достижение: Цифровой авангард (пицца или 💎 — уточнить)
ach_culture_support    | 1000 | Достижение: Поддержка коллег
ach_culture_cross      | 600  | Достижение: Межфункциональное взаимодействие
```

### Цепочка начисления

```
ach_evaluations (status → 'approved')
       │
       ▼  DB-функция: ach_grant_awards(evaluation_id)
       │
       ├─► ach_awards (запись для каждого получателя)
       │
       ├─► gamification_event_logs
       │     event_type = 'ach_revit_leader'
       │     source = 'achievements'
       │     details = {"achievement_id": "...", "evaluation_id": "...", "value": 367, "role": "winner"}
       │
       ├─► gamification_transactions (coins = 2000, event_id = ↑)
       │
       └─► gamification_balances (обновляется существующим триггером)
```

**Результат**: в логах и транзакциях видно начисление за достижение.
Фильтр по `source = 'achievements'` покажет все такие записи.

---

## 7. Flow: автоматический dry_run + ручное подтверждение

```
┌─ Cron (конец квартала) ИЛИ кнопка в админке ──────────────┐
│                                                            │
│  1. Запускаются evaluate-функции для каждого достижения    │
│  2. Результаты → ach_evaluations                           │
│     status = 'awaiting_approval'                           │
│  3. all_candidates заполняется полным рейтингом            │
│                                                            │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ Админка ─────────────────────────────────────────────────┐
│                                                            │
│  Список evaluations со статусом 'awaiting_approval'        │
│  Для каждого: победитель, метрика, полный рейтинг          │
│  Кнопки: [Подтвердить] [Отклонить] [Пересчитать]          │
│                                                            │
└────────────────────────────────────────────────────────────┘
                          │
                    [Подтвердить]
                          │
                          ▼
┌─ DB-функция: ach_grant_awards(evaluation_id) ─────────────┐
│                                                            │
│  1. Создаёт ach_awards для каждого получателя              │
│  2. Пишет в gamification_event_logs                        │
│  3. Пишет в gamification_transactions                      │
│  4. Баланс обновляется триггером                           │
│  5. Статус evaluation → 'approved'                         │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 8. DB-функции (stored procedures)

Каждое достижение = отдельная функция. Когда правила изменятся — меняется одна функция, таблицы не трогаются.

```
ach_evaluate_revit_leader(p_start date, p_end date)      → uuid (evaluation_id)
ach_evaluate_revit_team(p_start date, p_end date)         → uuid
ach_evaluate_revit_department(p_start date, p_end date)   → uuid
ach_evaluate_culture_support(p_start date, p_end date)    → uuid
ach_evaluate_culture_cross(p_start date, p_end date)      → uuid

ach_grant_awards(p_evaluation_id uuid)                    → void (начисление)
ach_run_all_evaluations(p_start date, p_end date)         → void (запуск всех)
```

### Логика evaluate-функций

**`ach_evaluate_revit_leader`** — Лидер автоматизации:

```
1. SELECT user, SUM(coins) FROM gamification_transactions
   WHERE event_type LIKE 'revit_%' AND event_date BETWEEN p_start AND p_end
   GROUP BY user ORDER BY SUM DESC
2. Победитель = TOP 1
3. Записать в ach_evaluations с полным рейтингом
```

**`ach_evaluate_revit_team`** — Технологичная команда:

```
1. Для каждой команды: среднее кол-во revit-💎 на сотрудника
2. Включая "Вне команд *" — они тоже участвуют
3. Победитель = TOP 1 по среднему
4. Записать в ach_evaluations
```

**`ach_evaluate_revit_department`** — Цифровой авангард:

```
1. Для каждого отдела: (юзеры хотя бы с 1 revit-событием) / (всего активных юзеров)
2. Победитель = TOP 1 по проценту вовлечённости
3. Записать в ach_evaluations
```

**`ach_evaluate_culture_support`** — Поддержка коллег:

```
1. SELECT recipient_email, COUNT(*) FROM at_gratitudes
   WHERE airtable_created_at BETWEEN p_start AND p_end AND NOT deleted_in_airtable
   GROUP BY recipient_email ORDER BY COUNT DESC
2. Победитель = TOP 1
3. Записать в ach_evaluations
```

**`ach_evaluate_culture_cross`** — Межфункциональное взаимодействие:

```
1. Для каждого получателя: кол-во уникальных отделов отправителей
2. Фильтр: >= 3 отделов
3. Все прошедшие порог получают достижение (это НЕ топ-1, а пороговое)
4. Записать в ach_evaluations
```

### Логика ach_grant_awards

```
1. Проверить status = 'awaiting_approval' или 'approved'
2. Определить получателей:
   - individual: один user
   - team: все ws_users WHERE team = winner_entity_id AND is_active
   - department: все ws_users WHERE department = winner_entity_id AND is_active
3. Для каждого получателя:
   a. INSERT INTO ach_awards
   b. INSERT INTO gamification_event_logs (source = 'achievements')
   c. INSERT INTO gamification_transactions
4. UPDATE ach_evaluations SET status = 'approved'
```

---

## 9. Подводные камни и открытые вопросы

### Требуют ответа

**Q1: "💎" vs "запуски" для Revit**
Сейчас `revit_using_plugins` = 5 💎 за **день** использования (не за каждый запуск).
Человек с 367 запусками и человек с 10 запусками за день получают одинаковые 5 💎.
"Лидер автоматизации" по 💎 = лидер по количеству **дней**, а не запусков.
→ **Это правильное поведение? Или нужно считать запуски?**

**Q2: "Цифровой авангард" — кого считать в знаменателе?**
% вовлечённости = (юзеры с revit) / (всего в отделе).
Сметчики, менеджеры не используют Revit по роли.
→ **Считать от всех в отделе или только от "технических" ролей?**

**Q3: Пицца для отдела — 💎 или вне системы?**
Для "Цифрового авангарда" — "пицца ИЛИ 💎 на командный счёт".
→ **Сколько 💎 и кому? Каждому сотруднику? Или это вне приложения?**

**Q4: Переходящие призы (кубок, тотем)**
→ **Нужно ли отслеживать у кого сейчас физический приз? (Ожидает уточнения)**

**Q5: Минимальный порог для благодарностей**
Сейчас 18 благодарностей, у всех по 1 за квартал.
→ **Добавить минимум (например, 3+ благодарности) чтобы не выдавать случайному победителю?**

### Известные риски

1. **"Вне команд" участвуют** — 13 человек в "Вне команд АР пром" конкурируют с командой из 3. Может вызвать вопросы, но решено включать их.

2. **Межфункциональное взаимодействие** — отдел отправителя берётся из `ws_users`. Если отправитель не в `ws_users` — его отдел неизвестен, благодарность не учитывается для этого достижения.

3. **Идемпотентность** — `UNIQUE(achievement_id, user_id, period_start)` в `ach_awards` защищает от двойного начисления при повторном запуске.

4. **Система молодая** — данные копятся с середины марта 2026. Первые квартальные достижения — не раньше конца Q2 2026 (полный квартал данных).

---

## 10. Текущее состояние в приложении

### UI (уже есть, мок)

- Стена достижений на `/achievements` — 9 карточек, 3 группы
- Данные захардкожены в `src/lib/data.ts` (массив `achievements[]`)
- 2 "заработанных" (мок), 7 "заблокированных"

### БД (НЕТ ничего)

- Нет таблицы достижений
- Нет event_type для достижений в `gamification_event_types`
- Нет функций/триггеров для достижений

### Что нужно создать

1. Миграция: 3 таблицы (`ach_definitions`, `ach_evaluations`, `ach_awards`)
2. Заполнение `ach_definitions` (5 записей)
3. Добавление event_types в `gamification_event_types` (5 записей)
4. DB-функции: 5 evaluate + 1 grant + 1 run_all
5. RLS-политики на таблицы
6. Edge function или cron для запуска
7. UI в админке для просмотра/подтверждения evaluations
8. Обновление страницы `/achievements` — данные из БД вместо мока
