# streak-shield

Вторая жизнь для стриков. Пользователь покупает защиту стрика за коины после красного дня (grace period 24ч).

## Логика работы

При красном дне (WS) или пропуске плагина (Revit) стрик не сбрасывается сразу — ставится pending с 24-часовым дедлайном. Пользователь видит предупреждение с таймером и может купить "Вторую жизнь". Покупка моментально спасает стрик. Если время истекло — стрик сбрасывается при следующем прогоне скрипта/триггера.

Заранее купить нельзя — только при наличии pending (после красного дня).

### WS стрик (VPS-скрипт compute-gamification)
- Фаза 1: финализация неразрешённых pending (`pending_reset_date IS NOT NULL` → сброс)
- Фаза 2: red день → `pending_reset_date = вчера`, `pending_reset_expires_at = now()+24h`. Стрик не трогается.
- Green день → обычная логика + очистка pending

### Revit стрик (триггер fn_award_revit_points)
- gap_days > 0 → pending вместо сброса, `last_green_date` обновляется
- При следующем запуске: если pending expired → сброс; если pending active → skip streak update
- Ежедневная очистка: `fn_finalize_expired_revit_pendings()` (вызывается из sync-plugin)

### Покупка щита (server action buyStreakShield)
1. Проверить pending в streak-таблице
2. Проверить grace period не истёк
3. Найти товар по `effect` в `shop_products`
4. `purchase_product` (атомарное списание коинов)
5. Очистить pending
6. Записать лог в `streak_shield_log`

## Зависимости

- `ws_user_streaks` — pending_reset_date, pending_reset_expires_at
- `revit_user_streaks` — pending_reset_date, pending_reset_expires_at, pending_gap_days
- `shop_products` — колонка `effect` ('streak_shield_ws', 'streak_shield_revit')
- `streak_shield_log` — история использований
- `shop_orders` — связь через order_id
- `gamification_event_types` — 'streak_shield_used'
- `purchase_product` — DB-функция покупки

## Типы

- `ShieldType` — 'ws' | 'revit'
- `PendingReset` — данные для UI: type, pendingResetDate, expiresAt, currentStreak, price, productId
- `ShieldLogEntry` — строка лога: userId, userName, shieldType, protectedDate, createdAt

## Actions

- `buyStreakShield(shieldType)` — покупка щита. Side effects: purchase_product, очистка pending, insert в streak_shield_log, revalidatePath

## Queries

- `getPendingResets(userId)` — pending для WS и Revit (для UI таймера)
- `getShieldLog()` — лог всех использований (для админки, limit 100)

## Ограничения

- Щит нельзя купить заранее — только при активном pending
- Grace period: 24 часа от момента установки pending
- Для Revit: один щит покрывает один пропущенный рабочий день. Gap > 1 = нужно столько щитов
- Стоимость: 500 коинов за каждый тип
- Товары идентифицируются по `shop_products.effect`, не по ID
