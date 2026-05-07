# Привязка цен к BYN и BYN-метрики в дашборде

## Цель

Перевести магазин и дашборд экономики на привязку к белорусскому рублю.

- Админ вводит реальную себестоимость товара в BYN и коэффициент наценки
- Цена в кристаллах, которую видит пользователь, считается на лету: `price_crystals = round(cost_byn × coefficient × current_rate)` — всегда целое число
- Курс хранится с историей в новой таблице `crystal_rates` — последняя запись = актуальный курс
- Транзакции (`gamification_transactions`) получают новое поле `byn_amount`, заполняется автоматически через `BEFORE INSERT` триггер от `current_crystal_rate()`
- Дашборд экономики (`/admin/economy`) показывает суммы в BYN рядом с кристаллами во всех KPI/топах/категориях
- Курс редактируется на странице `/admin/products` с preview-режимом: ввод нового значения → таблица товаров пересчитывается локально → отдельная кнопка «Применить» сохраняет в БД

## Стартовые условия

- Текущий курс: **80 кристаллов = 1 BYN** (т.е. 1 кристалл = 0.0125 BYN)
- Все существующие товары: `cost_byn = price / 80`, `coefficient = 1.0`
- Колонка `shop_products.price` **удаляется** в Этапе 3 (после backfill `cost_byn`). История заказов остаётся корректной — `coins` зафиксирован в каждой `gamification_transactions`

## Решения, согласованные с заказчиком

| Вопрос | Решение |
|---|---|
| Имя таблицы курса | `crystal_rates` |
| Хранение цены в кристаллах | Не хранится отдельно, считается на лету (Variant A) |
| `byn_amount` в транзакциях | Хранится для всех транзакций, заполняется через `BEFORE INSERT` триггер (производное от `coins / current_crystal_rate()`) |
| Дашборд | Кристаллы остаются, BYN добавляется рядом |
| UI курса | На `/admin/products`, с preview-режимом перед применением |

## Этапы реализации

### Этап 1: БД — таблица курсов и поле в транзакциях

**Затрагиваемые объекты:**
- Новая таблица `crystal_rates`
- Новая колонка `gamification_transactions.byn_amount numeric(12,2) NULL`
- Новая SQL-функция `current_crystal_rate() returns numeric` — возвращает последний курс из `crystal_rates`
- RLS на `crystal_rates`: SELECT для authenticated, INSERT только для admin (через `is_admin = true` в JWT)

**Миграция (`054_crystal_rates_and_byn.sql`):**

```sql
CREATE TABLE crystal_rates (
  id          bigserial PRIMARY KEY,
  rate        numeric(8,4) NOT NULL CHECK (rate > 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES ws_users(id)
);

INSERT INTO crystal_rates (rate, created_by) VALUES (80, NULL); -- стартовый курс

CREATE OR REPLACE FUNCTION current_crystal_rate() RETURNS numeric
LANGUAGE sql STABLE AS $$
  SELECT rate FROM crystal_rates ORDER BY id DESC LIMIT 1;
$$;

ALTER TABLE gamification_transactions
  ADD COLUMN byn_amount numeric(12,2);
-- backfill: byn_amount = round(coins / 80, 2) для всех существующих
UPDATE gamification_transactions SET byn_amount = round(coins::numeric / 80, 2);

-- товары: cost_byn + coefficient
ALTER TABLE shop_products
  ADD COLUMN cost_byn    numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN coefficient numeric(5,2)  NOT NULL DEFAULT 1.0 CHECK (coefficient > 0);
UPDATE shop_products SET cost_byn = round(price::numeric / 80, 2), coefficient = 1.0;

-- RLS
ALTER TABLE crystal_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rates_select" ON crystal_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "rates_insert_admin" ON crystal_rates FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true);
```

**Зависимости:** нет.

**Критерии готовности этапа:**
- `SELECT current_crystal_rate()` возвращает 80
- `gamification_transactions.byn_amount` заполнено для всех старых строк
- `shop_products.cost_byn` и `coefficient` заполнены для всех существующих товаров

---

### Этап 2: Триггер `BEFORE INSERT` для авто-заполнения `byn_amount`

`byn_amount` — производное от `coins / current_crystal_rate()`, одинаковая формула для всех 8+ RPC, создающих транзакции. Триггер исключает копипасту и автоматически покрывает будущие RPC.

**Миграция (`055_byn_amount_trigger.sql`):**

```sql
CREATE OR REPLACE FUNCTION fn_set_byn_amount() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.byn_amount IS NULL THEN
    NEW.byn_amount := round(NEW.coins::numeric / current_crystal_rate(), 2);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_set_byn_amount
  BEFORE INSERT ON gamification_transactions
  FOR EACH ROW EXECUTE FUNCTION fn_set_byn_amount();
```

Если по какой-то причине вызывающий код явно задал `byn_amount` (например, корректирующая ручная транзакция) — триггер уважает это значение. По умолчанию вычисляет из `coins`.

**Зависимости:** Этап 1 (нужна `current_crystal_rate()` и колонка `byn_amount`).

**Критерии готовности этапа:**
- Триггер создан
- INSERT любой транзакции (через любой из 8 RPC) автоматически заполняет `byn_amount`
- Проверка на dev: тестовая покупка → `byn_amount = round(coins / 80, 2)`

---

### Этап 3: Server-side — модуль shop

**Затрагиваемые файлы:**
- `src/modules/shop/types.ts` — добавить `cost_byn`, `coefficient` в `ShopProduct`. Обновить `createProductSchema` / `updateProductSchema`: убрать `price`, добавить `cost_byn` (positive number), `coefficient` (positive, default 1.0)
- `src/modules/shop/queries.ts` — `getProducts*` возвращают вычисленное поле `price` в кристаллах через формулу
- `src/modules/shop/actions.ts` — `createProduct` / `updateProduct`: принимают `cost_byn` + `coefficient`, поле `price` больше не фигурирует. Добавить новый action `setCrystalRate(rate: number)` — INSERT в `crystal_rates`, проверка `checkIsAdmin()`, revalidate `/admin/products`, `/store`, `/admin/economy`. Zod-схема валидирует `rate > 0`
- `src/modules/shop/index.ts` / `index.client.ts` — экспорт `setCrystalRate`, `getCurrentRate`

**Удаление колонки `price`:**

`purchase_product` переписывается так, чтобы цена в кристаллах считалась внутри RPC: `v_price_crystals := round(p.cost_byn * p.coefficient * current_crystal_rate())::integer`. Затем — обычная проверка баланса и списание. Колонка `shop_products.price` удаляется через `ALTER TABLE`.

**Затрагиваемые файлы:**
- `supabase/migrations/056_purchase_product_byn.sql` — пересоздаёт `purchase_product` (цена считается на лету), удаляет `shop_products.price`. `cancel_order` — refund по `coins` из исходной транзакции, без изменений в логике

**Зависимости:** Этап 1, Этап 2.

**Критерии готовности:**
- Создание товара в админке без `price`, только `cost_byn` + `coefficient`
- Покупка использует актуальный курс
- Изменение курса меняет цену в магазине без вмешательства в товары

---

### Этап 4: Admin UI — курс и форма товара на `/admin/products`

**Затрагиваемые файлы:**
- `src/modules/admin/components/ProductsClient.tsx` — добавить компонент `<CrystalRatePanel />` сверху таблицы товаров
- Новый файл `src/modules/admin/components/CrystalRatePanel.tsx` — клиентский компонент:
  - Отображает текущий сохранённый курс
  - Инпут «Новый курс» (число)
  - Тоггл «Preview» (по умолчанию выкл) — когда включён, в `ProductsClient` цены товаров пересчитываются через инпут-курс (через React Context или prop drilling — выбрать по структуре)
  - Кнопка «Применить» — вызывает `setCrystalRate(newRate)` через `useTransition`, после успеха `revalidatePath('/admin/products')`
- `src/modules/admin/components/ProductFormModal.tsx` — заменить инпут «Цена в кристаллах» на два инпута: «Себестоимость, BYN» + «Коэффициент». Под ними — превью «Цена для пользователя: N 💎» (live при изменении инпутов)
- `src/modules/shop/queries.ts` — новая `getCurrentRate()` (SELECT из `crystal_rates` ORDER BY id DESC LIMIT 1). Admin переиспользует через импорт, без дублирования
- `src/app/(main)/admin/products/page.tsx` — параллельно загружает `getCurrentRate()` и передаёт в `ProductsClient`

**Состояние preview:**

`ProductsClient` хранит `previewRate: number | null` в локальном `useState` и передаёт его prop'ом в строки таблицы (без Context, без prop drilling глубже одного уровня). Если `previewRate !== null` — строки рендерят вычисленные цены через `previewRate`, иначе через `actualRate` из props. Тоггл переключает state между `null` и значением из инпута. Сама БД не трогается до клика «Применить».

**Зависимости:** Этап 3 (нужны actions и queries).

**Критерии готовности:**
- На странице `/admin/products` сверху виден текущий курс
- Ввод нового курса + preview переключатель — пересчитывает цены товаров локально
- Кнопка «Применить» сохраняет курс в БД, цены пересчитываются для всех (включая `/store`)
- В форме товара — `cost_byn` + `coefficient`, превью цены в кристаллах

---

### Этап 5: Дашборд экономики — суммы в BYN

**Затрагиваемые файлы:**
- `src/modules/admin/queries.ts` — `getEconomyOverview` / `getEconomyTop` / `getEconomyCategoryBreakdown` уже агрегируют `coins`. Расширить агрегаты: `byn = SUM(byn_amount)` рядом с `coins = SUM(coins)`
- Соответствующие RPC-миграции (`051_economy_dashboard_rpc.sql`, `052_*`, `053_*`) — пересоздать с дополнительным полем `byn` в возвращаемом результате. Новая миграция `057_economy_dashboard_byn.sql`
- `src/modules/admin/types.ts` — добавить `byn` поля в `EconomyOverview`, `EconomyTopRow`, `EconomyCategoryBreakdown`
- `src/modules/admin/components/economy/KpiSummary.tsx` — под `<CoinStatic amount={value} />` показать `≈ {byn} BYN`
- `src/modules/admin/components/economy/SpendingBreakdown.tsx` — аналогично, BYN-сумма второй строкой
- `src/modules/admin/components/economy/TopList.tsx` — добавить колонку BYN или вторую строку под `coins`
- `src/modules/admin/components/economy/CategoryBreakdownChart.tsx` — в легенде/тултипе доп. строка BYN

**Формат отображения:**

Шрифт BYN-суммы — мельче и `var(--apex-text-secondary)`, чтобы не конкурировать с основной кристалл-метрикой. Формат: `≈ 1 250.50 BYN` (через `toLocaleString('ru-BY', { minimumFractionDigits: 2 })`).

**Утилита:**

Сначала проверить `src/lib/` на существующие форматтеры (`formatNumber`, `formatCurrency` и т.п.). Если есть — расширить параметром валюты. Если нет — добавить `formatByn(amount: number): string` в существующий `format.ts` (если есть) или создать новый. Использовать во всех 5 местах через единую функцию.

**Зависимости:** Этап 1 (`byn_amount` есть в транзакциях), Этап 2 (новые транзакции тоже идут с `byn_amount`).

**Критерии готовности:**
- Все 4 KPI показывают BYN рядом с кристаллами
- Все 6 топов показывают BYN
- Категории магазина показывают BYN
- Числа сходятся: `byn ≈ coins / 80` для всех агрегатов при курсе 80

---

### Этап 6: Документация

**Затрагиваемые файлы:**
- `src/docs/shop.md` — обновить раздел «Типы», «Actions», «Queries»: новые поля `cost_byn`/`coefficient`, action `setCrystalRate`, формула цены
- `src/docs/admin.md` — раздел «Логика работы»: panel курса на `/admin/products`, дашборд показывает BYN
- `src/docs/gamification-db.md` (если существует) — таблица `crystal_rates`, поле `byn_amount`

**Зависимости:** все предыдущие этапы.

---

## Порядок коммитов

1. `feat(db): crystal_rates table + byn_amount column + backfill`
2. `feat(db): byn_amount in 8 transaction-creating RPCs`
3. `feat(shop): cost_byn + coefficient on products, on-the-fly price`
4. `feat(admin): crystal rate panel with preview on /admin/products`
5. `feat(economy): BYN amounts in dashboard KPI/top/categories`
6. `docs: shop, admin, gamification-db modules`

## Критерии готовности фичи

- [ ] Курс хранится в `crystal_rates`, последняя запись = актуальный
- [ ] Админ может менять курс на `/admin/products` с preview перед применением
- [ ] Все товары имеют `cost_byn` + `coefficient`, цена в кристаллах считается формулой
- [ ] Покупка работает с актуальным курсом
- [ ] Все 8 RPC, создающих транзакции, заполняют `byn_amount`
- [ ] Дашборд `/admin/economy` показывает BYN рядом с кристаллами во всех 4 KPI, 6 топах, категориях магазина
- [ ] `npm run build` и `npm run lint` проходят
- [ ] Документация модулей `shop` и `admin` обновлена
- [ ] Pragmatic Architect, Cache Guardian, Clean Code Guardian — без замечаний

## Риски и edge-cases

- **Race condition при покупке** во время изменения курса: `purchase_product` использует `FOR UPDATE` на балансе и товаре, плюс на момент списания берётся актуальный `current_crystal_rate()`. Цена честная, история (фактически списанные кристаллы + BYN) сохраняется в транзакции
- **Возврат заказа после смены курса**: refund возвращает столько же кристаллов, сколько было списано (из исходной транзакции). BYN refund: `coins / current_crystal_rate()` — отражает возврат по текущему курсу, корректно для дашборда
- **Округление**: `byn_amount` хранится с 2 знаками после запятой. Цена в кристаллах для пользователя — целое число (`round(...)::integer`). Сумма `SUM(byn_amount)` может на копейки расходиться с `SUM(coins) / rate` — на показываемые цифры не влияет

## Финальные решения

1. **`purchase_product` переписываем** — цена в кристаллах считается на лету через `current_crystal_rate()` × `cost_byn` × `coefficient`. Колонка `shop_products.price` удаляется из таблицы. История заказов остаётся корректной — фактически списанные кристаллы хранятся в `gamification_transactions.coins`
2. **Округление — `round()` до целого**. Цена в кристаллах для пользователя — всегда целое число (без дробной части). На уровне SQL: `round(cost_byn * coefficient * current_crystal_rate())::integer`. На уровне TS — `Math.round(cost_byn * coefficient * rate)`
3. **Минимум курса — `> 0`**. Без верхней границы. Чек в БД: `CHECK (rate > 0)`

