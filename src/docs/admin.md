# admin

Админ-панель для управления системой геймификации: события, пользователи, товары, заказы, календарь.

## Логика работы

Все actions проверяют `is_admin` через `checkIsAdmin()` — декодирование JWT access_token. Админские actions используют `supabaseAdmin` (service role, обходит RLS) — защита на уровне кода через `checkIsAdmin()`. Пользовательские actions (покупка и т.д.) используют обычный клиент + RLS.

Админ может менять стоимость событий (coins) в `gamification_event_types`. Добавление/удаление event types запрещено — они создаются в миграциях и привязаны к триггерам/скриптам.

Управление заказами: смена статуса (pending/processing/fulfilled) через дропдаун на статус-бейдже, отмена с возвратом 💎 через модал подтверждения. Нефизические товары — статус не меняется (только отмена).

Управление товарами: inline-редактирование категории, себестоимости в BYN, коэффициента и остатка в таблице. Цена в кристаллах — read-only, вычисляется по формуле `cost_byn × coefficient × current_crystal_rate()`. Полное редактирование через модалку (ProductFormModal — два инпута + live-превью цены). Удаление товара с проверкой наличия заказов. Загрузка изображений через drag-and-drop (API route, не Server Action).

Управление курсом кристаллов: на странице `/admin/products` сверху таблицы — `CrystalRatePanel`. Показывает текущий курс, инпут нового значения, тоггл «Предпросмотр» (локально пересчитывает цены в таблице товаров без записи в БД), кнопка «Применить» (вызывает `setCrystalRate`). При применении — INSERT в `crystal_rates`, инвалидация тегов `crystal-rate` и `shop-products`.

Управление категориями: inline-редактирование всех полей (name, slug, description, is*physical, is_countable). Slug валидируется: только строчные латинские, цифры, *, начинается с буквы, уникальный. Деактивация категории блокирует тоггл статуса у товаров этой категории. `is_countable` — отдельный тоггл, определяет учёт остатков (stock); заблокирован для нефизических категорий. Переключение `is_physical → false` автоматически сбрасывает `is_countable`. При отключении `is_countable` — stock сбрасывается в NULL у всех товаров категории (optimistic на клиенте + серверный сброс).

Управление календарём: визуальный календарь на год + 1 месяц. Клик по дню переключает его состояние. Будний → выходной (INSERT calendar_holidays), выходной (Сб/Вс) → рабочий (INSERT calendar_workdays), уже переключённый → откат (DELETE). Названия записей автоматические ("Выходной" / "Рабочий перенос"). Множественные клики не блокируются — optimistic updates работают параллельно. Данные учитываются в стриках (VPS-скрипт пропускает праздники, обрабатывает рабочие переносы) и в гриде дней (streak-panel: праздник → gray, перенос → рабочий).

## Зависимости

- `gamification_event_types` — справочник событий (SELECT для authenticated, UPDATE для админов)
- `ws_users` — справочник сотрудников (is_admin)
- `shop_orders` — заказы (JOIN с ws_users, shop_products, shop_categories, gamification_transactions)
- `calendar_holidays` — праздники/нерабочие дни (date UNIQUE, name, created_by)
- `calendar_workdays` — рабочие переносы (date UNIQUE, name, created_by)
- `custom_access_token_hook` — pg-функция, добавляет `is_admin` и `ws_user_id` в JWT
- Модули: `auth` (getCurrentUser), `shop` (actions, queries, types)

## Типы

- `EventTypeRow` — строка из `gamification_event_types`: key, name, coins, description, is_active
- `UpdateEventTypeInput` — Zod-схема: key (string, обязателен), name/coins/description/is_active (опционально)
- `AdminUserRow` — пользователь с балансом: id, email, first_name, last_name, department, team, is_admin, is_active, total_coins
- `UserDetail` — `{ user: AdminUserRow, transactions: UserTransaction[] }`
- `UserTransaction` — строка из `view_user_transactions`: event_date, event_type, source, coins, description, details (jsonb), created_at
- `AdminOrderRow` — заказ с user_name, user_email, product_name, product_emoji, product_image_url, is_physical, coins_spent, status, note, status_changed_by, status_changed_at
- `UpdateOrderStatusInput` — Zod-схема: orderId (uuid), status (pending/processing/fulfilled), note (optional)
- `CancelOrderInput` — Zod-схема: orderId (uuid), note (optional, max 500)
- `CalendarHolidayRow` — строка из calendar_holidays: id, date, name, created_at
- `CalendarWorkdayRow` — строка из calendar_workdays: id, date, name, created_at
- `AddCalendarDateInput` — Zod-схема: date (YYYY-MM-DD), name (1-100 символов)
- `DeleteCalendarDateInput` — Zod-схема: id (positive int)
- `ProductFormData` — данные формы товара: name, description, price, category_id, image_url, emoji, stock, sort_order

## Actions

- `updateEventType({ key, name?, coins?, description?, is_active? })` — обновляет поля события. Revalidate: `/admin/events`
- `toggleAdmin(userId)` — переключает is_admin у пользователя. Revalidate: `/admin/users`
- `updateOrderStatus({ orderId, status, note? })` — смена статуса заказа (кроме cancelled). Revalidate: `/admin/orders`, `/store/orders`
- `cancelOrder({ orderId, note? })` — отмена заказа с возвратом 💎 через RPC `cancel_order`. Revalidate: `/admin/orders`, `/store/orders`, `/store`, `/profile`
- `addCalendarHoliday({ date, name })` — добавляет праздник. Проверяет конфликт с calendar_workdays. Revalidate: `/admin/calendar`
- `deleteCalendarHoliday({ id })` — удаляет праздник. Revalidate: `/admin/calendar`
- `addCalendarWorkday({ date, name })` — добавляет рабочий перенос. Проверяет конфликт с calendar_holidays. Revalidate: `/admin/calendar`
- `deleteCalendarWorkday({ id })` — удаляет рабочий перенос. Revalidate: `/admin/calendar`

## Queries

- `getEventTypes()` — все event types, сортировка по coins DESC
- `getUsers()` — все активные сотрудники с балансом (ws_users LEFT JOIN gamification_balances)
- `getUserDetail(userId)` — пользователь + последние 50 транзакций из view_user_transactions
- `getOrders()` — все заказы с данными покупателя, товара (name, emoji, image_url, is_physical через category) и суммой. supabaseAdmin
- `getCalendarHolidays()` — все записи из calendar_holidays, сортировка по date ASC
- `getCalendarWorkdays()` — все записи из calendar_workdays, сортировка по date ASC
- `getEconomyOverview(filters)` — RPC `get_economy_overview`. Возвращает KPI экономики (заработано, отозвано фактически, фактически заработано = earned − revoked, подарено компанией = Σ |expected| − |actual| по revoked-транзакциям, clamped/total counts) + 5 каналов трат (shop, lottery, second_life, paid_gratitudes, quota_gratitudes), каждый с `{ coins, users }`. Бета-фильтр на получателе/покупателе/отправителе соответствующего канала. Revoke-транзакции по задачам, закрытым до `2026-03-25`, не учитываются — дата закрытия резолвится через `LEFT JOIN ws_tasks_l3/l2` по `ws_task_id` из `details` с фоллбеком на `details.original_details.date_closed` и `event_date`
- `getEconomyTop(filters, source, level)` — RPC `get_economy_top`. Топ-список по одному из 6 источников (`'earned' | 'shop' | 'lottery' | 'second_life' | 'paid_gratitude' | 'revoked'`) на одном из 3 уровней (`'user' | 'team' | 'department'`). Возвращает все строки (slice до 10 на UI). Без `team`/`department` группируются как «Без команды» / «Без отдела». Источник `'revoked'` использует тот же cutoff по дате закрытия задачи (≥ 2026-03-25), что и `getEconomyOverview`
- `getEconomyCategoryBreakdown(filters)` — RPC `get_economy_category_breakdown`. Категории магазина с агрегатом 💎/orders + JSON-массив товаров категории (для детализации по клику). Возвращает только категории с покупками за период (coins > 0)
- `resolveEconomyPeriod(preset, customFrom?, customTo?)` — утилита: преобразует пресет периода (`7d/30d/90d/year/all/custom`) в ISO-границы `{from, to}`. `'all'` → `{null, null}`

## Компоненты

- `AdminNav` — навигация по разделам админки (табы: Overview, Events, Users, Products, Orders, Calendar, Achievements, Shields, Lottery, Economy, Help)
- `economy/EconomyDashboard` — серверный контейнер дашборда экономики. Принимает `period`/`customFrom`/`customTo`/`betaOnly`/`topLevel`/`overview`/`categories`/`tops` и рендерит `EconomyFilters` → `KpiSummary` → `SpendingBreakdown` → `CategoryBreakdownChart` → grid из 6 `TopList`
- `economy/EconomyFilters` — клиентский компонент фильтров: пресеты периода (7д/30д/90д/Год/Всё время/Период), `DateRangePicker` для кастомного диапазона, тоггл «Только бета-тестеры», переключатель уровня топов (Сотрудники/Команды/Отделы). Все изменения через `router.replace` в URL searchParams (`useTransition` для индикации загрузки). Чипсы вынесены в локальный helper `ChipButton`
- `economy/KpiSummary` — серверный блок «Сводка»: 4 KPI-карточки (заработано / фактически заработано / отозвано фактически / подарено компанией) + строка «Не хватило баланса на полный штраф в N из M отзывов (X%)». Принимает `rate`, под суммой кристаллов показывает `≈ {byn} BYN`
- `economy/SpendingBreakdown` — серверный блок «Куда уходят 💎»: 5 карточек по каналам (магазин, лотерея, вторая жизнь, платные благодарности, квотные благодарности), каждая с суммой 💎, BYN-эквивалентом и количеством участников. Принимает `rate`. Для plurals — локальный helper `pluralize`
- `economy/TopList` — клиентский переиспользуемый топ: заголовок с иконкой, превью первых 10 позиций (каждая с 💎 и BYN-подписью), кнопка «Показать всех» открывает модалку (через портал) с полным списком. Принимает `rate`. Опциональный `secondaryLabel` для счётчика транзакций (покупок / отправок / билетов)
- `economy/CategoryBreakdownChart` — клиентский блок «Категории магазина»: Recharts donut + легенда-список с строкой BYN под суммой кристаллов. Принимает `rate`, BYN добавляется в tooltip, в строку категории и в карточки товаров
- `EventTypesTable` — таблица событий с inline-редактированием (name, coins, description), table-layout: fixed
- `AdminUsersClient` — обёртка над UsersTable, принимает `AdminUserRow[]`
- `UsersTable` — таблица пользователей с поиском, фильтрацией по отделу, тогглом «только админы», группировкой по отделам/командам, inline-переключением ролей
- `RoleToggle` — контекст-компонент для управления ролями: `RoleProvider` (state + optimistic), `RoleBadge` (отображение), `RoleSwitch` (интерактивный тоггл)
- `UserDetailModal` — боковая панель с деталями пользователя и последними 50 транзакциями. Загружает данные через API route `/api/admin/user-detail`
- `ProductsClient` — управление товарами и категориями: inline-редактирование (cost_byn, coefficient, category, stock), поиск, фильтрация по категориям (динамический overflow пиллов), удаление товаров, создание/редактирование через модалку. Принимает `currentRate`, держит локальный `previewRate` state. Цена в кристаллах в таблице — вычисляется через `effectiveRate = previewRate ?? currentRate`. Рендерит `CrystalRatePanel` сверху
- `CrystalRatePanel` — клиентский компонент управления курсом: инпут «Новый курс», тоггл «Предпросмотр» (изменяет previewRate в родителе через callback), кнопка «Применить» (вызывает `setCrystalRate` через useTransition). Кнопка «Применить» disabled при равенстве draft и currentRate
- `ProductFormModal` — модалка создания/редактирования товара: два инпута (Себестоимость BYN + Коэффициент) с live-превью цены в кристаллах, кастомный дропдаун категории, эмодзи-инпут (Win+.), drag-and-drop загрузка изображений, блокировка скролла. Принимает `rate`. Рендерится через портал
- `AdminOrdersClient` — управление заказами: дропдаун статуса на бейдже (через портал, вложенный `StatusDropdown` с позиционированием через useRef), кнопка отмены, раскрываемые комментарии, модал подтверждения отмены (через портал)
- `CalendarClient` — визуальный календарь на год + 1 месяц (январь текущего года → январь следующего). Подкомпоненты: `MonthCard` (сетка дней одного месяца), `LegendItem` (элемент легенды). Четыре состояния дня: workday (белый фон), weekend (серый), holiday (красный, из calendar_holidays), workday_transfer (зелёный, из calendar_workdays). Клик по дню переключает состояние. Optimistic updates без блокировки — параллельные клики работают, каждый startTransition независим. Подсветка текущего дня через inset box-shadow
- `AdminPlaceholder` — заглушка для неактивных разделов
- `AdminTableSkeleton` — скелетон загрузки таблиц

## Утилиты

- `checkIsAdmin()` — декодирует JWT, возвращает boolean. Используется во всех админских actions
- `formatTransactionReason(tx)` — формирует человеко-читаемое описание причины красного дня из `tx.details`. Поддерживает типы: `red_day`, `task_dynamics_violation`, `section_red`, `wrong_status_report`. Возвращает строку с текстом и ссылкой на задачу WS или `null`. Ссылка берётся приоритетно из `ws_task_url`, иначе строится по project/task ID. Используется в `/admin/users/[id]` и `UserDetailModal`

## UI-паттерны

- Все toast-уведомления рендерятся через `createPortal(…, document.body)` — обход transform containing block от анимаций
- Модалки рендерятся через портал (backdrop на весь экран)
- Дропдауны (статус заказа, тип категории) рендерятся через портал с `position: fixed` — не обрезаются overflow: hidden
- Inline-редакторы закрываются при клике вне поля (onBlur с проверкой relatedTarget)
- Таблицы используют `table-layout: fixed` с `<colgroup>` для стабильных колонок при inline-редактировании
- Тоггл статуса товара блокируется (disabled + opacity 0.4) при неактивной категории

## API Routes

- `GET /api/admin/user-detail?id={userId}` — детали пользователя для `UserDetailModal`. Guard: `checkIsAdmin()` → 403. Возвращает `UserDetail` JSON или 404
- `POST /api/admin/upload-product-image` — загрузка изображения товара. Guard: `checkIsAdmin()` → 403. FormData с полем `file`. Валидация: JPEG/PNG/WebP, max 2 МБ. Storage path: `products/{timestamp}_{uuid}.{ext}`. Возвращает публичный URL

## Страницы

- `/admin` — layout с заголовком и `AdminNav`. Главная — placeholder
- `/admin/events` — `getEventTypes()` → `EventTypesTable`
- `/admin/users` — `getUsers()` → `AdminUsersClient`
- `/admin/users/[id]` — `getUserDetail(id)` → детальная страница пользователя с `RoleProvider`, информационными карточками, списком транзакций. Транзакции red_day/task_dynamics_violation/section_red/wrong_status_report показывают причину красным + кликабельную ссылку на задачу WS. 404 если не найден
- `/admin/products` — `getAllProducts()` + `getAllCategories()` параллельно → `ProductsClient`
- `/admin/orders` — `getOrders()` → `AdminOrdersClient`
- `/admin/calendar` — `getCalendarHolidays()` + `getCalendarWorkdays()` параллельно → `CalendarClient`
- `/admin/economy` — Server Component с `checkIsAdmin()` (редирект на `/` для не-админов). Парсит searchParams (`period`, `from`, `to`, `beta`, `topLevel`), резолвит ISO-границы периода через `resolveEconomyPeriod` (для `'custom'` конвертирует YYYY-MM-DD → ISO начала/конца дня). Параллельно (`Promise.all`) вызывает `getEconomyOverview` + 6× `getEconomyTop` (по одному на каждый источник топа). Передаёт URL-state и данные в `EconomyDashboard`. Дефолты: `period='all'`, `betaOnly=true`, `topLevel='user'`

Все страницы с данными имеют `loading.tsx` со скелетонами.

## Ограничения

- Админ не может добавлять/удалять event types — только менять coins
- Отмена заказа: любой статус кроме `cancelled`. 💎 возвращаются через RPC `cancel_order`
- Смена статуса на `cancelled` только через `cancelOrder` (не через `updateOrderStatus`)
- Нефизические товары: статус заказа не меняется через дропдаун, только отмена
- Удаление товара запрещено при наличии заказов
- Slug категории: `^[a-z][a-z0-9_]*$`, уникальный среди категорий
- Одна дата не может быть одновременно в calendar_holidays и calendar_workdays — actions проверяют конфликт
- Данные календаря учитываются в стриках (VPS-скрипт compute-gamification) и в гриде дней (streak-panel)
