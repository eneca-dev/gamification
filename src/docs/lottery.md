# lottery

Ежемесячный розыгрыш дорогого лота. Сотрудники покупают билеты за баллы, победитель определяется рандомом.

## Логика работы

Админ создаёт лотерею на текущий месяц — автоматически создаётся `shop_product` (билет) в категории "Розыгрыши" (slug: `draw`). Покупка билета = стандартный `purchase_product` RPC. Каждый `shop_order` = 1 билет = 1 шанс. Количество билетов не ограничено.

Шанс выигрыша (`мои_билеты / всего_билетов * 100`) показывается только после покупки хотя бы 1 билета.

Розыгрыш выполняется Edge Function `draw-lottery` по крону на 1-е число каждого месяца. Функция вызывает RPC `draw_lottery_winner`, который выбирает рандомный `shop_order` через `ORDER BY random() LIMIT 1`.

Возврат баллов проигравшим не делается — весь смысл в выводе баллов из оборота. Отмена лотереи невозможна.

## Зависимости

- Таблицы: `lottery_draws`, `shop_products`, `shop_orders`, `ws_users`
- Категория: `shop_categories` (slug: `draw`)
- RPC: `purchase_product` (покупка билетов), `draw_lottery_winner` (розыгрыш)
- Edge Function: `draw-lottery` (крон 1-го числа)
- Модули: `auth` (getCurrentUser), `admin` (checkIsAdmin), `shop` (purchaseProduct)

## Типы

- `LotteryStatus` — `'active' | 'completed'`
- `LotteryDraw` — строка из таблицы `lottery_draws`
- `LotteryWithStats` — лотерея + `total_tickets`, `total_participants`, `winner?`
- `UserTicketInfo` — `ticket_count`, `total_tickets`, `chance_percent`

## Actions

- `createLottery(input)` — создание лотереи на текущий месяц. Автосоздаёт shop_product. Только админ. Revalidate: `/admin/lottery`, `/store`

## Queries

- `getActiveLottery()` — активная лотерея со статистикой. `null` если нет
- `getLotteryHistory()` — завершённые лотереи с победителями, по убыванию месяца
- `getAllLotteries()` — все лотереи для админки (active + completed)
- `getUserTicketInfo(wsUserId, productId)` — билеты пользователя + шанс
- `getDrawCategoryId()` — ID категории "Розыгрыши"

## Компоненты

- `LotteryBanner` — секция в магазине: приз, обратный отсчёт, кнопка покупки, шанс
- `LotteryWinners` — список прошлых победителей
- `LotteryAdmin` — админский компонент: создание, текущая статистика, история

## Ограничения

- Максимум 1 активная лотерея (UNIQUE на `month`, EXCLUDE на `status = 'active'`)
- `month` всегда 1-е число (CHECK constraint)
- Цена билета задаётся при создании, не изменяется
- Отмена лотереи невозможна
- Возврат баллов за билеты не производится
