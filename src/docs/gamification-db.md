# gamification-db

Схема базы данных системы геймификации. Справочник сотрудников, источники событий, журнал начислений, администрирование.

---

## Логика работы

Баллы начисляются всем сотрудникам из `ws_users` по email, независимо от регистрации в приложении. Регистрация (OAuth через Worksection) лишь связывает `auth.users` с записью `ws_users.user_id`.

Поток данных:
1. Edge functions синкают сырые данные из внешних систем в source-таблицы (`elk_plugin_launches`, `at_gratitudes`, `ws_daily_reports`).
2. **PostgreSQL-триггеры** срабатывают мгновенно при каждом INSERT/UPDATE в source-таблицах и вставляют строки в `gamification_event_logs` с уникальным `idempotency_key`. Дубли физически невозможны — UNIQUE constraint.
3. Каждое событие автоматически создаёт запись в `gamification_transactions` и обновляет `gamification_balances`.
4. Стрики Revit обновляются прямо в триггере в `revit_user_streaks` — отдельного cron не требуется.
5. Стоимости событий читаются из `gamification_event_types`.
6. Приложение читает из `gamification_balances` (баланс), `gamification_event_logs` (история), `revit_user_streaks` (стрики).

---

## Зависимости

- **Supabase Auth** — `auth.users`: регистрация, сессии, `auth.uid()`, `auth.jwt()`
- **Worksection API** — источник `ws_users`, `ws_projects`, `ws_daily_reports`
- **Elasticsearch / Kibana** — источник `elk_plugin_launches`
- **Airtable** — источник `at_gratitudes`

---

## Вспомогательные SQL-функции

Используются в RLS-политиках и RPC. Все с `SECURITY DEFINER`.

| Функция | Что делает |
|---|---|
| `my_ws_user_id()` | UUID из `ws_users` по email из JWT |
| `my_email()` | Email текущего пользователя из JWT |
| `get_user_id_by_email(email)` | UUID из `ws_users` по email |

---

## Таблицы

### Группа A: Справочник сотрудников

#### `ws_users`

Мастер-список всех сотрудников. Синкается edge function `sync-ws-users` из Worksection. Не требует регистрации в приложении — баллы начисляются всем 575 активным сотрудникам.

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | |
| `email` | text UNIQUE | **Нижний регистр** (CHECK constraint). Ключ связи со всеми source-таблицами |
| `first_name` | text | |
| `last_name` | text | |
| `department` | text NULL | Полное название с кодом: "(КР гражд) Конструктивные решения" |
| `department_code` | text NULL | Извлечён regex из `department`: КР, ОВ, ЭС, АР, ТМ... |
| `team` | text NULL | Команда внутри отдела |
| `ws_user_id` | integer NULL | ID пользователя в Worksection |
| `user_id` | uuid NULL → auth.users ON DELETE SET NULL | Заполняется при первом входе через OAuth |
| `is_active` | boolean | |
| `synced_at` | timestamptz | |

Индексы: `email`, `user_id`, `department_code`, `is_active WHERE is_active = true`.

#### `ws_projects`

Синкается edge function `sync-ws-projects`.

| Колонка | Тип | Описание |
|---|---|---|
| `ws_project_id` | integer PK | |
| `name` | text | |
| `status` | text | |
| `synced_at` | timestamptz | |

---

### Группа B: Source-таблицы (только service_role пишет)

Данные из внешних систем. FK на `ws_users` не используются — связь через JOIN по email в триггерах.

#### `elk_plugin_launches`

Запуски Revit-плагинов. Синкается из Elasticsearch/Kibana. Одна строка на (user_email, work_date, plugin_name).

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | |
| `user_email` | text | |
| `work_date` | date | |
| `plugin_name` | text | |
| `launch_count` | integer | |
| `synced_at` | timestamptz | |

Триггер: `trg_award_revit_points` → `fn_award_revit_points()`

#### `at_gratitudes`

Благодарности из Airtable. Синкается edge function `sync-at_gratitudes` (только текущий месяц).

| Колонка | Тип | Описание |
|---|---|---|
| `id` | text PK | Airtable record ID |
| `sender_email` | text NULL | |
| `recipient_email` | text NULL | |
| `recipient_name` | text | |
| `message` | text | |
| `airtable_created_at` | timestamptz | |
| `week_start` | date | Понедельник недели создания (для подсчёта лимита) |
| `airtable_status` | text NULL | |
| `deleted_in_airtable` | boolean | Soft-delete |
| `synced_at` | timestamptz | |

Триггер: `trg_award_gratitude_points` → `fn_award_gratitude_points()`

---

### Группа C: Ядро геймификации

#### `gamification_event_types`

Справочник типов событий и их стоимостей. Управляется вручную.

| Колонка | Тип | Описание |
|---|---|---|
| `key` | text PK | Уникальный ключ события |
| `coins` | integer | Количество монет (+ начисление, − списание) |
| `description` | text NULL | |
| `is_active` | boolean DEFAULT true | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Текущие ключи (Revit + Gratitudes):

| key | coins | Описание |
|---|---|---|
| `revit_using_plugins` | +5 | Зелёный день Revit |
| `revit_streak_7_bonus` | +25 | Бонус стрик 7 дней |
| `revit_streak_30_bonus` | +100 | Бонус стрик 30 дней |
| `gratitude_recipient_points` | +20 | Получатель благодарности |
| `second_life_cost` | −500 | Артефакт «Вторая жизнь» |
| `team_contest_top1_bonus` | +200 | Топ-1 отдел (Revit) |

WS-ключи (добавляет коллега): `ws_streak_7`, `ws_streak_30`, `ws_streak_90` и другие.

#### `gamification_event_logs`

Универсальный лог всех событий. Append-only. Одна запись = одно событие.

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → ws_users ON DELETE RESTRICT | |
| `user_email` | text | Денормализация для быстрых запросов |
| `event_type` | text FK → gamification_event_types.key | |
| `source` | text | `revit` / `airtable` / `ws` / `shop` |
| `event_date` | date | Когда произошло событие |
| `details` | jsonb NULL | Контекст события (discriminated union по source) |
| `idempotency_key` | text UNIQUE NULL | Защита от двойных начислений |
| `created_at` | timestamptz | |

Формат `details` по source:

| source | Поля details |
|---|---|
| `revit` | `plugin_name`, `launch_count` |
| `airtable` | `gratitude_id`, `sender_email` |
| `ws` | `ws_task_id`, `ws_task_name`, `ws_project_id`, ... |

idempotency_key форматы (Revit + Gratitudes):

| Событие | Ключ |
|---|---|
| Revit зелёный день | `revit_green_{email}_{date}` |
| Revit стрик 7 дней | `revit_streak_7_{email}_{date}` |
| Revit стрик 30 дней | `revit_streak_30_{email}_{date}` |
| Благодарность получена | `gratitude_recipient_{airtable_id}` |

#### `gamification_transactions`

История начислений/списаний монет. Каждая запись привязана к событию.

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → ws_users | |
| `user_email` | text | |
| `event_id` | uuid FK → gamification_event_logs.id | |
| `coins` | integer | + начисление, − списание |
| `created_at` | timestamptz | |

#### `gamification_balances`

Кэш текущего баланса. Обновляется атомарно вместе с `gamification_transactions`.

| Колонка | Тип | Описание |
|---|---|---|
| `user_id` | uuid PK FK → ws_users | |
| `total_coins` | integer DEFAULT 0 | |
| `updated_at` | timestamptz | |

Если баланс рассинхронизировался — пересчитать:
```sql
UPDATE gamification_balances b
SET total_coins = (SELECT COALESCE(SUM(coins), 0) FROM gamification_transactions t WHERE t.user_id = b.user_id),
    updated_at = now();
```

#### `revit_user_streaks`

Стрики Revit-плагинов. Одна запись на сотрудника (PK = `user_id`). Обновляется триггером `fn_award_revit_points()` мгновенно.

| Колонка | Тип | Описание |
|---|---|---|
| `user_id` | uuid PK, FK → ws_users ON DELETE CASCADE | |
| `current_streak` | integer DEFAULT 0 | Текущая серия |
| `best_streak` | integer DEFAULT 0 | Максимальная серия за всё время |
| `last_green_date` | date NULL | Дата последнего засчитанного дня |
| `is_frozen` | boolean DEFAULT false | Заморозка на время отпуска/больничного |
| `freeze_reason` | text NULL | |
| `frozen_at` | timestamptz NULL | |
| `updated_at` | timestamptz | |

Индексы: `revit_user_streaks_current_idx (current_streak DESC)`.

Логика обновления стрика (в триггере):
- `last_green_date = work_date` → уже засчитан, пропустить
- `is_frozen = true` → не трогать
- между `last_green_date` и `work_date` нет рабочих пропусков (выходные + отсутствия) → `current_streak + 1`
- есть рабочие дни без запусков → `current_streak = 1`

---

### Группа D: WS геймификация (управляется коллегой)

`ws_user_streaks`, `budget_pending` — создаются и управляются edge function `compute-gamification`. Не трогать.

---

### Группа E: Магазин *(не создан — следующий этап)*

Таблицы `store_products`, `store_purchases`, `second_life_activations` и RPC `create_purchase`, `activate_second_life` создаются в следующем этапе.

---

## Триггеры

Все срабатывают `AFTER INSERT OR UPDATE FOR EACH ROW`. Функции — `SECURITY DEFINER`.

| Триггер | Таблица | Функция | Что делает |
|---|---|---|---|
| `trg_award_revit_points` | `elk_plugin_launches` | `fn_award_revit_points()` | +5 за зелёный день, обновляет стрик, бонус при 7/30 |
| `trg_award_gratitude_points` | `at_gratitudes` | `fn_award_gratitude_points()` | +20 получателю благодарности |

Идемпотентность: все триггеры используют `ON CONFLICT (idempotency_key) DO NOTHING` — повторный запуск синка не создаёт дублей.

Процесс записи в триггерах (атомарно):
1. `INSERT gamification_event_logs` с `idempotency_key` → ON CONFLICT DO NOTHING
2. `INSERT gamification_transactions` (event_id, coins)
3. `UPSERT gamification_balances` (total_coins += coins)

---

## RLS-политики

| Таблица | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `ws_users` | authenticated | service_role | service_role | запрещено |
| `ws_projects` | authenticated | service_role | service_role | запрещено |
| `elk_plugin_launches` | authenticated | service_role | service_role | запрещено |
| `at_gratitudes` | authenticated | service_role | service_role | запрещено |
| `gamification_event_logs` | authenticated | service_role + SECURITY DEFINER | запрещено | запрещено |
| `gamification_transactions` | authenticated | service_role + SECURITY DEFINER | запрещено | запрещено |
| `gamification_balances` | authenticated | service_role + SECURITY DEFINER | SECURITY DEFINER | запрещено |
| `revit_user_streaks` | authenticated | service_role | service_role | запрещено |

---

## Ограничения

- `gamification_event_logs` и `gamification_transactions` никогда не удаляются и не обновляются напрямую.
- Email в `ws_users` — всегда нижний регистр (CHECK constraint). Все source-таблицы хранят email как есть — сравнение в триггерах через `lower()`.
- Отрицательный баланс допустим (штрафы). Запрещён только при покупке — проверяется в `create_purchase()`.
- WS-часть (`ws_user_streaks`, `budget_pending`, `gamification_event_logs` WS-события) управляется коллегой через `compute-gamification`.
