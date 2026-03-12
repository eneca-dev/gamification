# gamification-db

Схема базы данных системы геймификации. Справочник сотрудников, источники событий, журнал начислений, администрирование.

---

## Логика работы

Баллы начисляются всем сотрудникам из `ws_users` по email, независимо от регистрации в приложении. Регистрация (OAuth через Worksection) лишь связывает `auth.users` с записью `ws_users.user_id`.

Поток данных:
1. Edge functions синкают сырые данные из внешних систем в source-таблицы (`elk_plugin_launches`, `at_gratitudes`, `work_planning_freshness`, `ws_daily_status`).
2. **PostgreSQL-триггеры** срабатывают мгновенно при каждом INSERT/UPDATE в source-таблицах и вставляют строки в `coin_transactions` с уникальным `idempotency_key`. Дубли физически невозможны — UNIQUE constraint.
3. Стрики обновляются прямо в триггере — отдельного cron не требуется.
4. Приложение читает из `coin_transactions`, `streaks` и делает SUM по балансам.

---

## Зависимости

- **Supabase Auth** — `auth.users`: регистрация, сессии, `auth.uid()`, `auth.jwt()`
- **Worksection API** — источник `ws_users`, `ws_projects`, `ws_daily_status` (WS-часть)
- **Elasticsearch / Kibana** — источник `elk_plugin_launches`
- **Airtable** — источник `at_gratitudes`
- **eneca.work Supabase** — источник `work_planning_freshness`, `work_work_planning_freshness_daily`

---

## Вспомогательные SQL-функции

Используются в RLS-политиках и RPC. Все с `SECURITY DEFINER`.

| Функция | Что делает |
|---|---|
| `my_email()` | Email текущего пользователя из JWT (`auth.jwt() ->> 'email'`), нижний регистр |
| `my_ws_user_id()` | UUID из `ws_users` по email из JWT |
| `is_admin()` | Проверяет наличие `auth.uid()` в `admin_users` |

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

Важно: `sync-ws-users` никогда не трогает `user_id` и `department_code` — эти поля заполняются отдельно.

#### `ws_projects`

Синкается edge function `sync-ws-projects`. Используется для связи задач с проектами.

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

Запуски Revit-плагинов. Синкается из Elasticsearch/Kibana.

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
| `deleted_in_airtable` | boolean | Soft-delete: запись исчезла из Airtable |
| `synced_at` | timestamptz | |

Триггер: `trg_award_gratitude_points` → `fn_award_gratitude_points()`

#### `work_planning_freshness`

Актуальность планирования по командам. Синкается edge function `sync-planning-freshness`.

| Колонка | Тип | Описание |
|---|---|---|
| `team_id` | uuid PK | ID команды в eneca.work |
| `ws_team_id` | integer NULL | |
| `team_name` | text | |
| `department_id` | uuid | |
| `department_name` | text | |
| `last_confirmed_at` | timestamptz NULL | |
| `last_loading_update` | timestamptz NULL | |
| `active_loadings_count` | integer | |
| `last_update` | timestamptz NULL | Последнее обновление (confirmed или loading) |
| `days_since_update` | integer | Дней с последнего обновления |
| `team_lead_email` | text NULL | |
| `department_head_email` | text NULL | |
| `synced_at` | timestamptz | |

Триггер: `trg_award_planning_points` → `fn_award_planning_points()`

#### `work_work_planning_freshness_daily`

Снапшоты `work_planning_freshness` за каждый день. Заполняется при вызове `sync-planning-freshness?snapshot=true`.

PK: `(team_id, snapshot_date)`.

#### `ws_daily_status` *(WS-часть — заполняется коллегой)*

Ежедневный статус сотрудника по Worksection. Создана, edge function и триггер будут добавлены отдельно.

| Колонка | Тип | Описание |
|---|---|---|
| `id` | bigserial PK | |
| `employee_id` | uuid FK → ws_users ON DELETE CASCADE | |
| `status_date` | date | |
| `status` | text CHECK | `green` / `red` / `frozen` |
| `logged_hours` | numeric(5,2) | |
| `freeze_reason` | text NULL | `vacation` / `sick_leave` / `day_off` |
| `created_at` | timestamptz | |

UNIQUE: `(employee_id, status_date)`.

#### `ws_task_events` *(WS-часть — создаётся коллегой)*

События WS-задач (закрытие, переоткрытие, бюджеты). Не создана — коллега создаёт по аналогии.

#### `budget_awards_queue` *(WS-часть — создаётся коллегой)*

Очередь отложенных выплат за соблюдение бюджета (через 30 дней). Не создана — коллега создаёт по аналогии.

---

### Группа C: Ядро геймификации

#### `coin_transactions`

Неизменяемый финансовый журнал. Append-only. UPDATE и DELETE политики отсутствуют для всех ролей. Отмена — только через RPC `cancel_transaction()`.

| Колонка | Тип | Описание |
|---|---|---|
| `id` | bigserial PK | |
| `employee_id` | uuid FK → ws_users ON DELETE RESTRICT | |
| `event_type` | text | Тип события (см. таблицу ниже) |
| `amount` | integer | Положительный = начисление, отрицательный = списание |
| `description` | text NULL | Читаемое описание |
| `source_type` | text NULL | `elk_plugin_launches` / `at_gratitudes` / `work_planning_freshness` / `streaks` / `admin` |
| `source_id` | text NULL | ID исходной записи |
| `idempotency_key` | text UNIQUE | Защита от двойных начислений |
| `is_cancelled` | boolean DEFAULT false | |
| `cancelled_at` | timestamptz NULL | |
| `cancelled_by` | uuid NULL → ws_users ON DELETE SET NULL | |
| `cancel_reason` | text NULL | |
| `parent_id` | bigint NULL → coin_transactions ON DELETE RESTRICT | Ссылка на оригинальную транзакцию при сторнировании |
| `created_at` | timestamptz | |

Индексы: `(employee_id, created_at DESC)`, `event_type`, `(source_type, source_id)`, `created_at DESC`, `is_cancelled WHERE is_cancelled = false`.

Типы событий:

| event_type | Сумма | Кто получает | idempotency_key |
|---|---|---|---|
| `revit_green_day` | +5 | Сотрудник | `revit_green_{email}_{date}` |
| `revit_streak_bonus` | +25 / +100 | Сотрудник | `revit_streak_7_{email}_{date}` / `revit_streak_30_{email}_{date}` |
| `gratitude_received` | +20 | Получатель | `gratitude_recipient_{airtable_id}` |
| `gratitude_sent` | +10 | Отправитель (макс 3/нед) | `gratitude_sender_{airtable_id}` |
| `planning_bonus` | +30 | Тимлид / Нач. отдела | `planning_bonus_lead_{team_id}_{last_update_date}` |
| `planning_penalty` | -30 | Тимлид / Нач. отдела | `planning_penalty_lead_{team_id}_{3day_period}` |
| `ws_green_day` | +10 | Сотрудник | `ws_green_{employee_id}_{date}` *(WS-часть)* |
| `ws_streak_bonus` | +50/+200/+500 | Сотрудник | `ws_streak_{N}_{employee_id}_{date}` *(WS-часть)* |
| `cancel_adjustment` | -N | Оригинальный получатель | `cancel_{original_tx_id}` |
| `manual_adjustment` | ±N | Любой сотрудник | `manual_{employee_id}_{epoch}` |

#### `streaks`

Текущие стрики сотрудников по каждому источнику. Обновляются триггерами мгновенно.

| Колонка | Тип | Описание |
|---|---|---|
| `id` | bigserial PK | |
| `employee_id` | uuid FK → ws_users ON DELETE CASCADE | |
| `streak_type` | text | `ws_green_days` / `revit_green_days` / `planning_updates` |
| `current_streak` | integer DEFAULT 0 | Текущая серия |
| `best_streak` | integer DEFAULT 0 | Максимальная серия за всё время |
| `last_green_date` | date NULL | Дата последнего засчитанного дня |
| `is_frozen` | boolean DEFAULT false | Заморозка на время отпуска/больничного |
| `freeze_reason` | text NULL | |
| `frozen_at` | timestamptz NULL | |
| `budget_ok_streak` | integer DEFAULT 0 | Серия L3-задач без превышения бюджета (для «Мастер планирования») |
| `updated_at` | timestamptz | |

UNIQUE: `(employee_id, streak_type)`.

Логика обновления стрика (в триггере):
- `last_green_date = new_date - 1` → `current_streak + 1`
- `last_green_date = new_date` → уже засчитан, пропустить
- иначе → `current_streak = 1`
- `is_frozen = true` → не трогать

#### `audit_log`

Журнал административных действий. Пишется только через SECURITY DEFINER RPC. Прямой INSERT запрещён.

| Колонка | Тип | Описание |
|---|---|---|
| `id` | bigserial PK | |
| `actor_id` | uuid NULL → ws_users ON DELETE SET NULL | NULL = системный процесс |
| `actor_email` | text NULL | Снапшот email на момент действия |
| `action` | text | `cancel_transaction` / `manual_adjustment` / ... |
| `target_table` | text NULL | |
| `target_id` | text NULL | |
| `details` | jsonb NULL | Детали действия |
| `created_at` | timestamptz | |

Индексы: `(actor_id, created_at DESC)`, `action`, `(target_table, target_id)`, `created_at DESC`.

---

### Группа D: Администрирование

#### `admin_users`

| Колонка | Тип | Описание |
|---|---|---|
| `user_id` | uuid PK → auth.users ON DELETE CASCADE | |
| `role` | text DEFAULT 'admin' CHECK | `admin` / `superadmin` |
| `granted_by` | uuid NULL → auth.users ON DELETE SET NULL | |
| `granted_at` | timestamptz | |

Bootstrap первого администратора — только вручную через Supabase Dashboard:
```sql
INSERT INTO admin_users (user_id, role) VALUES ('<uuid из auth.users>', 'superadmin');
```

#### `event_coin_config`

Единое хранилище всех коэффициентов начисления. Читается триггер-функциями при каждом срабатывании.

| Колонка | Тип | Описание |
|---|---|---|
| `key` | text PK | |
| `value` | numeric | |
| `description` | text NULL | |
| `updated_at` | timestamptz | |

Текущие значения:

| Ключ | Значение | Описание |
|---|---|---|
| `revit_green_day_points` | 5 | Зелёный день Revit |
| `revit_streak_7_bonus` | 25 | Бонус за 7 дней подряд |
| `revit_streak_30_bonus` | 100 | Бонус за 30 дней подряд |
| `gratitude_sender_points` | 10 | Баллы отправителю |
| `gratitude_recipient_points` | 20 | Баллы получателю |
| `gratitude_weekly_sender_cap` | 3 | Макс. начислений отправителю в неделю |
| `planning_update_bonus` | 30 | Бонус за актуализацию ≤3 дней |
| `planning_overdue_penalty` | 30 | Штраф за просрочку >7 дней (каждые 3 дня) |
| `ws_green_day_points` | 10 | Зелёный день WS |
| `ws_streak_7_bonus` | 50 | Бонус за 7 дней WS |
| `ws_streak_30_bonus` | 200 | Бонус за 30 дней WS |
| `ws_streak_90_bonus` | 500 | Бонус за 90 дней WS |
| `ws_teamlead_l3_budget_bonus` | 10 | Тимлиду за L3 в бюджете |
| `ws_executor_budget_bonus` | 50 | Исполнителю за L3 в бюджете |
| `ws_teamlead_l2_budget_bonus` | 200 | Тимлиду за L2 в бюджете |
| `ws_master_planning_streak` | 10 | Задач подряд для «Мастер планирования» |
| `ws_master_planning_bonus` | 450 | Бонус за «Мастер планирования» |
| `second_life_cost` | 500 | Стоимость артефакта «Вторая жизнь» |
| `team_contest_top1_bonus` | 200 | Бонус каждому сотруднику отдела-победителя |

---

### Группа E: Магазин *(не создан — следующий этап)*

Таблицы `store_products`, `store_purchases`, `second_life_activations` и RPC `create_purchase`, `activate_second_life` создаются в этапе 4.

---

## Триггеры

Все срабатывают `AFTER INSERT OR UPDATE FOR EACH ROW`. Функции — `SECURITY DEFINER`.

| Триггер | Таблица | Функция | Что делает |
|---|---|---|---|
| `trg_award_revit_points` | `elk_plugin_launches` | `fn_award_revit_points()` | +5 за зелёный день, обновляет стрик, бонус при 7/30 |
| `trg_award_gratitude_points` | `at_gratitudes` | `fn_award_gratitude_points()` | +20 получателю, +10 отправителю (лимит 3/нед) |
| `trg_award_planning_points` | `work_planning_freshness` | `fn_award_planning_points()` | +30 бонус (≤3 дня) или -30 штраф (>7 дней) |

Идемпотентность: все триггеры используют `ON CONFLICT (idempotency_key) DO NOTHING` — повторный запуск синка не создаёт дублей.

---

## RPC-функции (SECURITY DEFINER)

| Функция | Кто вызывает | Что делает |
|---|---|---|
| `cancel_transaction(id, reason)` | admin | Устанавливает `is_cancelled = true`, создаёт сторнирующую транзакцию, пишет в `audit_log` |
| `add_manual_adjustment(employee_id, amount, reason)` | admin | Создаёт `coin_transactions` с `event_type = 'manual_adjustment'`, пишет в `audit_log` |

---

## RLS-политики

| Таблица | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `ws_users` | authenticated | service_role | service_role | запрещено |
| `ws_projects` | authenticated | service_role | service_role | запрещено |
| `elk_plugin_launches` | authenticated | service_role | service_role | запрещено |
| `at_gratitudes` | authenticated | service_role | service_role | запрещено |
| `work_planning_freshness` | authenticated | service_role | service_role | запрещено |
| `work_work_planning_freshness_daily` | authenticated | service_role | service_role | запрещено |
| `ws_daily_status` | authenticated | service_role | service_role | запрещено |
| `coin_transactions` | authenticated | service_role + SECURITY DEFINER | только через RPC | запрещено |
| `streaks` | authenticated | service_role | service_role | запрещено |
| `audit_log` | только admin | service_role | запрещено | запрещено |
| `admin_users` | только admin | service_role | запрещено | service_role |
| `event_coin_config` | authenticated | service_role | service_role | запрещено |

---

## Ограничения

- `coin_transactions` никогда не удаляется и не обновляется напрямую. Только `cancel_transaction()`.
- Email в `ws_users` — всегда нижний регистр (CHECK constraint). Все source-таблицы хранят email как есть — сравнение в триггерах через `lower()`.
- Отрицательный баланс допустим (штрафы, sторнирование). Запрещён только при покупке — проверяется в `create_purchase()`.
- Первый `superadmin` создаётся вручную — автоматического bootstrap нет.
- WS-часть (`ws_daily_status` логика, `ws_task_events`, `budget_awards_queue`) создаётся отдельно по тому же паттерну.
