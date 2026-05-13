# streak-shield

Вторая жизнь для стриков. Пользователь покупает защиту стрика за 💎 после красного дня (grace period 24ч).

## Логика работы

При красном дне (WS) или пропуске плагина (Revit) стрик не сбрасывается сразу — ставится pending с 24-часовым дедлайном. Пользователь видит предупреждение с таймером и может купить "Вторую жизнь". Покупка моментально спасает стрик. Если время истекло — стрик сбрасывается при следующем прогоне скрипта/триггера.

Заранее купить нельзя — только при наличии pending (после красного дня).

### Квота бесплатных использований

Каждый сотрудник получает **2 бесплатных второй жизни в месяц** на каждый тип (ws и revit отдельно). Учёт ведётся в таблице `streak_shield_quota` с ключом `(user_id, shield_type, month)`.

- Если `free_used < 2` → `purchase_product` вызывается с `p_free=true` (цена 0, транзакция создаётся, баланс не списывается)
- Если `free_used >= 2` → стандартная платная покупка
- `FREE_SHIELDS_PER_MONTH = 2` — константа в `types.ts`

### WS стрик (VPS-скрипт compute-gamification)

- Фаза 1: финализация неразрешённых pending (`pending_reset_date IS NOT NULL` → сброс)
- Фаза 2: red день → `pending_reset_date = вчера`, `pending_reset_expires_at = now()+24h`. Стрик не трогается.
- Green день → обычная логика + очистка pending

### Revit стрик (VPS-скрипт compute-revit-gamification)

- Phase 1: финализация неразрешённых pending (`pending_reset_date < вчера` → событие `revit_streak_reset`, обнуление стрика, `streak_start_date = pending_reset_date + 1`)
- Phase 2: red день (нет launches за вчера) → `pending_reset_date = вчера`, `pending_reset_expires_at = now()+24h`. `current_streak` не трогаем (view вернёт его как замороженный во время грейса)
- Green день → upsert новой длины стрика (читается из view) + очистка pending
- Триггер `fn_award_revit_points` стрик больше не трогает — только идемпотентный лог + 5 💎 за первый плагин дня

### Покупка щита (server action buyStreakShield)

1. Проверить pending в streak-таблице
2. Проверить grace period не истёк
3. Найти товар по `effect` в `shop_products`
4. Проверить квоту в `streak_shield_quota` (текущий месяц)
5. `purchase_product(p_free=isFree)` — атомарное списание 💎 или бесплатная транзакция
6. Upsert `streak_shield_quota` (инкремент free_used или paid_used)
7. Очистить pending
8. Записать лог в `streak_shield_log`

## Зависимости

- `ws_user_streaks` — pending_reset_date, pending_reset_expires_at
- `revit_user_streaks_effective` — view, читается для отображения замороженного `current_streak` во время грейса
- `revit_user_streaks` — pending_reset_date, pending_reset_expires_at, pending_gap_days (legacy, не используется в новой модели)
- `shop_products` — колонка `effect` ('streak_shield_ws', 'streak_shield_revit')
- `streak_shield_log` — история использований (колонка `is_free` для аналитики)
- `streak_shield_quota` — учёт бесплатных/платных использований по месяцам
- `shop_orders` — связь через order_id (всегда создаётся, включая бесплатные)
- `gamification_transactions` — транзакция с coins=0 при бесплатной покупке
- `purchase_product` — DB-функция покупки (параметр `p_free boolean DEFAULT false`)

## Типы

- `ShieldType` — 'ws' | 'revit'
- `FREE_SHIELDS_PER_MONTH` — константа, текущее значение 2
- `PendingReset` — данные для UI: type, pendingResetDate, expiresAt, currentStreak, price, productId, freeUsesLeft
- `ShieldQuota` — квота текущего месяца: `{ ws: { freeUsed, paidUsed, freeLeft }, revit: {...} }`
- `ShieldLogEntry` — строка лога: userId, userName, shieldType, protectedDate, createdAt

## Actions

- `buyStreakShield(shieldType)` — покупка щита. Side effects: purchase_product, upsert streak_shield_quota, очистка pending, insert в streak_shield_log, revalidatePath

## Queries

- `getPendingResets(userId)` — pending для WS и Revit с `freeUsesLeft` (для UI таймера)
- `getShieldQuota(userId)` — квота текущего месяца для обоих типов (для карточки товара)
- `getShieldLog()` — лог всех использований (для админки, limit 100)

## Ограничения

- Щит нельзя купить заранее — только при активном pending
- Grace period: 24 часа от момента установки pending
- Для Revit: щит покрывает один пропущенный рабочий день. Если уже был pending — повторный red не перезаписывает `expires_at`
- Бесплатных жизней: 2 в месяц на каждый тип (ws и revit независимо)
- Стоимость платной: рассчитывается динамически через `current_crystal_rate()`
- Товары идентифицируются по `shop_products.effect`, не по ID
