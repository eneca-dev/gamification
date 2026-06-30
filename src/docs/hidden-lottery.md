# Скрытые упоминания: eneca-game / лотерея

Дата скрытия: 2026-06-29

Всё закомментировано маркером `[LOTTERY HIDDEN]`. Для восстановления — найти все вхождения этого маркера в коде.

---

## Закомментированный код

### 1. `src/modules/admin/components/AdminNav.tsx`
- **Строка 5**: импорт иконки `Ticket` из `lucide-react`
- **Строка 15**: пункт навигации `{ href: '/admin/lottery', label: 'eneca-game', icon: Ticket, exact: false }`

### 2. `src/app/(main)/store/page.tsx`
- **Строки 6–8**: импорты `getActiveLottery`, `getLotteryHistory`, `getUserTicketInfo`, `LotteryReveal`
- **Строки 20–21**: вызовы `getActiveLottery()` и `getLotteryHistory()` в `Promise.all`
- **Строки 24–38**: получение `ticketInfo`, `lastCompleted`, `wasParticipant`, фильтрация `filteredProducts`
- **Строки 43–45**: `<LotteryReveal ... />`
- **Строки 54–56**: пропы `activeLottery`, `ticketInfo`, `lotteryHistory` в `<StoreClient />`
- Переменная `filteredProducts` заменена обратно на `products`

### 3. `src/modules/shop/components/StoreClient.tsx`
- **Строки 12–13**: импорты `LotteryBanner`, `LotteryWinners`
- **Строка 16**: импорт типов `LotteryWithStats`, `UserTicketInfo`
- **Строки 24–27**: поля `activeLottery`, `ticketInfo`, `lotteryHistory`, `serverTime` в интерфейсе `StoreClientProps`
- **Строки 36–39**: дефолтные значения этих пропов в деструктуризации
- **Строки 202–231**: весь блок `activeFilter === 'draw'` (LotteryBanner + LotteryWinners + заглушка «нет активной игры»)

### 4. `src/modules/admin/components/economy/EconomyDashboard.tsx`
- **Строка 113**: `<TopList title="Игроки eneca-game" items={tops.lottery} iconName="ticket" secondaryLabel="входов" rate={rate} />`

### 5. `src/modules/admin/components/economy/SpendingBreakdown.tsx`
- **Строки 81–87**: блок `<ChannelCard label="eneca-game" channel={channels.lottery} ... />`
- **Строка 1**: импорт `Ticket` из `lucide-react` (становится неиспользуемым)

### 6. `src/modules/onboarding/page-slug.ts`
- **Строка 16**: `'/admin/lottery': 'admin-lottery'`

### 7. `src/modules/onboarding/components/OnboardingProvider.tsx`
- **Строка 24**: `import { adminLotteryTour } from '../tours/admin-lottery'`
- **Строка 34**: `adminLotteryTour` в массиве `TOURS`

### 8. `src/modules/onboarding/components/OnboardingDevPanel.tsx`
- **Строка 28**: `{ slug: 'admin-lottery', label: 'Лотерея (адм)' }` в массиве туров
- **Строка 44**: `'/admin/lottery': 'admin-lottery'` в маппинге путей

### 9. `src/modules/onboarding/tours/store.ts`
- **Строки 22–35**: шаг `store-lottery` (eneca-game) в массиве `steps`

### 10. `src/modules/onboarding/tours/admin.ts`
- **Строка 11**: в тексте описания убраны слова «и eneca-game»

### 11. `src/modules/onboarding/tours/admin-lottery.ts`
- Весь тур закомментирован (шаг `admin-lottery-current`)

---

## Изменения данных (2026-06-30)

### Категория `eneca-game` скрыта из магазина
- **Таблица**: `shop_categories`, **slug**: `draw`, **id**: `e493b896-bbb7-491e-be23-90b70f0eb7a2`
- `is_active`: `true` → `false`
- Причина: вкладка «eneca-game» в `/store` рендерится из `getCategories()` (только `is_active = true`). Товары-призы уже были `is_active=false`, но сама вкладка категории оставалась видимой.
- **Восстановление**: `UPDATE shop_categories SET is_active = true WHERE slug = 'draw';`
- Кэш `getCategories` (`tags: ['shop-categories']`, `revalidate: 1h`) — вкладка может оставаться видимой до ревалидации (до 1 часа) или редеплоя.

### Завершена тестовая лотерея
- **Таблица**: `lottery_draws`, **id**: `b9947507-16a5-4ad3-8d13-86efac697d80`, **name**: `тестовый приз!`
- `status`: `active` → `completed`, `drawn_at` проставлен. Участников не было (0 заказов), победитель не выбирался (`winner_user_id = null`).
- Товар-приз `eneca-game: тестовый приз!` (`shop_products` id `27f08bf0-c549-44dd-abf0-6e0322353a22`) **оставлен в БД** (`is_active=false`).
- **Восстановление активной игры**: `UPDATE lottery_draws SET status = 'active', drawn_at = NULL WHERE id = 'b9947507-16a5-4ad3-8d13-86efac697d80';`

### Про FK `lottery_draws_product_id_fkey`
`lottery_draws.product_id → shop_products.id` без `ON DELETE`. Товар, на который ссылается любая запись `lottery_draws` (активная или завершённая), удалить нельзя — Postgres вернёт `violates foreign key constraint`. Чтобы удалить товар-приз, нужно сначала удалить соответствующую строку `lottery_draws`. Завершение лотереи (`completed`) ссылку не снимает.

---

## Справка в базе данных

Эти статьи удалены или изменены в таблице `help_articles`.

### Удалена статья
- **id**: `191f19b3-f470-4661-8cfe-24ef3470962f`
- **slug**: `lottery`
- **title**: `eneca-game`
- **content** (полный текст ниже):

```
## 🎰 Что такое eneca-game

Каждый месяц проводится eneca-game — розыгрыш ценного приза. Вы входите в игру за 💎 — каждый вход = 1 шанс на победу.

## 🎮 Как войти в игру

1. В магазине найдите секцию «eneca-game»
2. Нажмите «Войти в игру» один или несколько раз
3. Дождитесь результата 1-го числа следующего месяца

## 📊 Шанс выигрыша

Ваш шанс = ваши входы ÷ все входы × 100%. Шанс отображается после первого входа. Чем больше раз войдёте — тем выше шанс.

## 📋 Правила

- Количество входов **не ограничено**
- Возврат 💎 **не производится** (даже если вы проиграли)
- Игра проходит **автоматически** 1-го числа
- Победитель выбирается **случайным образом**

## ❓ FAQ

### Можно ли вернуть 💎, если я передумал?
Нет. Вход в eneca-game необратим.

### eneca-game проводится каждый месяц?
eneca-game запускает администратор из HR отдела. Обычно — ежемесячно, но это зависит от решения администрации.

### Где узнать результаты?
В магазине в секции «eneca-game» отображается история победителей.
```

### Изменена статья «Магазин, eneca-game»
- **id**: `51bc3584-47e1-42fb-868e-1aba97c13f78`
- **slug**: `chatbot-shop`
- **title** изменён на: `Магазин`
- **Удалена секция** «Что такое eneca-game?» (была: ежемесячный розыгрыш ценного приза, победитель 1-го числа, ссылка на `/help/lottery`)
- **Изменена первая строка**: «Ассортимент включает реальные товары, **eneca-game** и **вторую жизнь** для стриков» → «Ассортимент включает реальные товары и **вторую жизнь** для стриков»

### Изменена статья «Как работает система»
- **id**: `7b418910-66c4-43b3-b573-ba4687d625df`
- **slug**: `how-it-works`
- **Изменена строка**: «Кристаллы можно тратить в магазине на реальные товары, eneca-game и защиту стриков» → «Кристаллы можно тратить в магазине на реальные товары и защиту стриков»

### Изменена статья «Кристаллы, зелёный день, красный день»
- **id**: `c70051d4-c114-438c-89fd-64c3eba6a0bb`
- **slug**: `chatbot-currency`
- **Изменена строка**: «Тратятся в магазине на реальные товары, eneca-game и защиту стриков» → «Тратятся в магазине на реальные товары и защиту стриков»

---

## Данные чат-бота (`src/docs-features/chatbot/`)

Эти файлы **не изменялись** (только фиксируем содержание для восстановления).

### `src/docs-features/chatbot/definitions.md`
- **Строка 17**: «Тратятся в магазине на реальные товары, eneca-game и защиту стриков»
- **Строка 226**: «Ассортимент включает реальные товары, **eneca-game** и **вторую жизнь** для стриков»
- **Строки 232–238**: раздел «Что такое eneca-game?» — полное описание механики, ссылка на `/help/lottery`

### `src/docs-features/chatbot/plan-chunks-admin.md`
- **Строка 46**: в таблице чанков: `chatbot-shop | Магазин, eneca-game, период достижений`

---

## Что НЕ трогалось

- `src/modules/lottery/` — весь модуль (actions, queries, types, components, index) остался нетронутым
- `supabase/migrations/` — миграции БД не изменялись (021_lottery_draws.sql и др.)
- `src/docs/lottery.md` — документация модуля
- `src/docs-features/lottery/` — планы фичи
- `src/modules/shop/actions.ts` — логика обновления ticket_price в lottery_draws при смене курса
- `src/app/(main)/admin/lottery/page.tsx` — страница существует, но недоступна через навигацию
