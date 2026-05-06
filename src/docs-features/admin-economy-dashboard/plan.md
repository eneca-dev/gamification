# Экономический дашборд админа

## Цель

Дать админу полную картину циркуляции 💎 в системе: сколько заработано, сколько фактически осталось у сотрудников после отзывов, на что уходят 💎 (магазин, лотерея, вторая жизнь, платные благодарности), кто больше всех зарабатывает/тратит на разных уровнях (сотрудник / команда / отдел), а также показать долю «подаренных компанией» 💎 — кейсов, когда отзыв был клампнут текущим балансом и часть штрафа фактически «простилась».

## Бизнес-контекст

- 💎 уходят из оборота только через 4 канала: магазин (обычные товары), лотерея (категория `draw`), вторая жизнь (`shop_products.effect IN ('streak_shield_ws','streak_shield_revit')`), платные благодарности (`gratitudes.gift_source='balance'`).
- Квотные благодарности (`gift_source='quota'`) кристаллов у отправителя не списывают — это «бесплатные» 💎 получателю.
- Отзывы (`*_revoked`) клампятся к текущему балансу: если сотрудник заработал и потратил быстрее, чем пришёл штраф, разница не списывается. Это и есть «подарок компании».
- На дашборде по умолчанию должны учитываться только бета-тестеры (`ws_users.is_beta_tester = true`).

## Бизнес-правила

- Период фильтрации: 7д / 30д / 90д / год / всё время / кастом (DateRangePicker)
- Тоггл «только бета-тестеры» (по умолчанию ON)
- Все KPI и топы пересчитываются от выбранного периода и фильтра
- Топы: 10 позиций + кнопка «показать всех» (модалка)
- Один общий переключатель уровня для всех топов: «Сотрудники / Команды / Отделы»
- Подарено компанией = Σ(|expected_coins| − |actual_coins|) по транзакциям отзывов, где фактическое списание меньше ожидаемого

## Источники данных

| Метрика | Источник |
|---------|----------|
| Заработано | `gamification_transactions.coins > 0` |
| Отозвано фактически | `gamification_transactions.coins < 0` JOIN event_logs WHERE `event_type LIKE '%_revoked%'` |
| Подарено компанией (clamped) | diff `gamification_event_types.coins` vs `gamification_transactions.coins` для тех же отзывов |
| Покупки в магазине (обычные) | `shop_orders` JOIN `shop_products` JOIN `shop_categories` WHERE `category.slug != 'draw'` AND `product.effect IS NULL` AND `status != 'cancelled'` |
| Лотерея | те же `shop_orders` WHERE `category.slug = 'draw'` |
| Вторая жизнь | те же `shop_orders` WHERE `product.effect IN ('streak_shield_ws','streak_shield_revit')` |
| Платные благодарности | `gratitudes` WHERE `gift_source='balance'` (сумма из `coins_amount`) |
| Квотные благодарности | `gratitudes` WHERE `gift_source='quota'` (сумма из `gamification_event_types['gratitude_recipient_points'].coins` × count) |

Бета-фильтр применяется через JOIN на `ws_users.is_beta_tester = true` для всех источников.

## Архитектура

### Размещение в admin

- Queries — в существующем `src/modules/admin/queries.ts` отдельной секцией (или рядом `queries.economy.ts`, без отдельного подмодуля).
- Типы — секцией в `src/modules/admin/types.ts`.
- Компоненты — `src/modules/admin/components/economy/`.
- Никаких новых `index.ts` и `actions.ts`. Действий-мутаций у дашборда нет.

### Queries (3 функции)

Все принимают `EconomyFilters = { from: Date | null; to: Date | null; betaOnly: boolean }`. `from = null && to = null` → «всё время». Все используют `supabaseAdmin`.

| Query | Возвращает |
|-------|-----------|
| `getEconomyOverview(filters)` | KPI Блока 1 + KPI Блока 2 одним проходом: `{ earned, revokedActual, factuallyEarned, giftedByCompany, clampedCount, totalRevokedCount, channels: { shop, lottery, secondLife, paidGratitudes, quotaGratitudes } }` где каждый channel = `{ coins, users }` |
| `getTop(filters, { source, level })` | `TopRow[]` для одного из 6 источников (`'earned' \| 'shop' \| 'lottery' \| 'second_life' \| 'paid_gratitude' \| 'revoked'`) на одном из уровней (`'user' \| 'team' \| 'department'`). Возвращает все строки — slice до 10 на UI делает компонент |
| `getCategoryBreakdown(filters)` | `CategoryRow[]` — категории магазина с суммой 💎 и количеством покупок |

Детализация товаров категории при клике — пока подгружаем все товары всех категорий вместе с `getCategoryBreakdown` (товаров в магазине мало, оптимизация преждевременна). При необходимости вынесем в отдельный query на этапе 4.

`TopRow = { id: string, name: string, value: number, secondary?: number | null }`.

### Управление состоянием

Всё через URL-searchParams. Никаких Server Actions для чтения, никакого client roundtrip:

- `?period=7d|30d|90d|year|all|custom`, `?from=...&to=...` для кастомного диапазона
- `?beta=on|off` (по умолчанию `on`)
- `?topLevel=user|team|department` (по умолчанию `user`) — общий для всех топов
- Изменение фильтра → `router.replace(новый URL)` → Server Component перерисовывается

Раскрытая категория для детализации — локальный `useState` в графике (это чисто UI-состояние, в URL не нужно).

### Компоненты (6 файлов в `src/modules/admin/components/economy/`)

| Компонент | Описание |
|-----------|----------|
| `EconomyDashboard.tsx` | Server Component-обёртка: принимает все данные пропсами, расставляет блоки |
| `EconomyFilters.tsx` | `'use client'`. Период (presets + DateRangePicker), бета-тоггл, переключатель уровня топов. Пишет в URL |
| `KpiSummary.tsx` | Блок 1: 4 карточки + строка «N из M отзывов клампнуто (X%)» с tooltip |
| `SpendingBreakdown.tsx` | Блок 2: 5 карточек по каналам (💎 + участники) |
| `TopList.tsx` | Переиспользуется 6 раз: заголовок, 10 строк, кнопка «Показать всех» → модалка через портал |
| `CategoryBreakdownChart.tsx` | `'use client'`. Recharts BarChart категорий, клик по бару раскрывает таблицу товаров (локальный `useState`) |

### Страница

```
src/app/(main)/admin/economy/
  page.tsx     — Server Component. Парсит searchParams в EconomyFilters, параллельно дёргает 3 query (getEconomyOverview, 6× getTop с одним level, getCategoryBreakdown), рендерит EconomyDashboard
  loading.tsx  — скелетон
```

`page.tsx` делает 8 query-вызовов параллельно через `Promise.all` (1 overview + 6 топов + 1 категории). Защита через `checkIsAdmin()` — редирект на `/` для не-админов.

### Изменения в `AdminNav.tsx`

Одна строка в массиве `navItems`: `{ href: '/admin/economy', label: 'Экономика', icon: Coins, exact: false }`.

## Этапы реализации

### Этап 1: Queries и типы

- В `src/modules/admin/types.ts` — `EconomyFilters`, `EconomyOverview`, `TopRow`, `TopSource`, `TopLevel`, `CategoryRow`
- В `src/modules/admin/queries.ts` — 3 функции: `getEconomyOverview`, `getTop`, `getCategoryBreakdown`
- Обновить `src/docs/admin.md` (новые queries в секции Queries)
- ~2 файла + docs

### Этап 2: Страница и фильтры

- `src/app/(main)/admin/economy/page.tsx` + `loading.tsx`
- `EconomyDashboard.tsx` (Server) + `EconomyFilters.tsx` (Client)
- Вкладка в `AdminNav.tsx`
- Парсинг searchParams в фильтры (Zod-схема для валидации)
- Обновить `src/docs/admin.md`
- ~5 файлов

### Этап 3: KPI блоки и топы

- `KpiSummary.tsx`, `SpendingBreakdown.tsx`, `TopList.tsx`
- Все KPI через `CoinIcon`/`CoinStatic`
- Цвета — только `--apex-*`
- Обновить `src/docs/admin.md`
- ~3 файла

### Этап 4: График категорий + детализация

- `CategoryBreakdownChart.tsx` — BarChart с раскрытием товаров категории по клику
- Обновить `src/docs/admin.md`
- ~1 файл

## Критерии готовности

- [ ] Вкладка «Экономика» появляется в админ-навигации
- [ ] Страница защищена через `checkIsAdmin()` (редирект для не-админов)
- [ ] Фильтр периода работает: 7д/30д/90д/год/всё время/кастом
- [ ] Тоггл «только бета-тестеры» работает, по умолчанию ON
- [ ] KPI «Фактически заработано» = заработано − отозвано фактически
- [ ] KPI «Подарено компанией» считается через diff expected vs actual для отзывов
- [ ] Показывается N из M отзывов клампнуто (X%)
- [ ] 5 каналов трат отображаются с суммой 💎 и количеством участников
- [ ] 6 топов реагируют на единый переключатель Сотрудники / Команды / Отделы
- [ ] Каждый топ имеет «Показать всех» с модалкой
- [ ] Блок «Что покупают» — BarChart категорий, клик → детализация по товарам
- [ ] Все цвета через `--apex-*`, никакого хардкода
- [ ] Все числа 💎 через `CoinIcon`/`CoinStatic`
- [ ] `loading.tsx` со скелетоном
- [ ] `npm run build` и `npm run lint` проходят
- [ ] `src/docs/admin.md` обновлён
