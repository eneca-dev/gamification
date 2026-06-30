# onboarding

Интерактивный постраничный онбординг для новых пользователей.

## Логика работы

При первом визите на страницу автоматически запускается пошаговый тур с подсказками. Каждый шаг подсвечивает целевой элемент (затемнение через SVG-маску с «дырками») и показывает tooltip с описанием. Шаг может подсветить несколько элементов сразу (`target` + `extraTargets`). Покрыты все пользовательские страницы и admin-панель.

Тур показывается **один раз** — запись в localStorage при старте гарантирует это. Закрытие вкладки, пропуск или прохождение до конца — всё записывает результат. Состояние синхронизируется с БД (`profiles.onboarding_seen`), поэтому при смене браузера или очистке localStorage туры повторно не показываются.

Поток:
1. `OnboardingProvider` монтируется → **один запрос к БД** (`getOnboardingSeenSlugs`) → все просмотренные slug-и записываются в localStorage → флаг `syncedRef = true`
2. Провайдер слушает `usePathname()`. До завершения синхронизации автозапуск заблокирован (polling 50мс, таймаут 3с — после истечения работает с тем что есть в localStorage)
3. При смене route → проверяет localStorage (`onboarding_v1:{userId}:{pageSlug}`)
4. Если записи нет → задержка 1.5с (ждём рендер) → записывает в localStorage + вызывает `markTourSeenInDb` в фоне → запускает тур
5. Target-элементы находятся по `data-onboarding="step-id"` атрибутам
6. Перед поиском target вызывается `step.onBeforeShow?.({ router })` (если задан) — для подготовки DOM (переключение таба, открытие аккордеона, переход на другую страницу). Вызывается и для модальных шагов (target=null)
7. Если target не найден за 3 сек → шаг пропускается (условные элементы вроде лотереи)

## Зависимости

- `framer-motion` — анимация tooltip
- `lucide-react` — иконки кнопок
- `localStorage` — локальный кэш состояния (источник для UI-проверок)
- `profiles.onboarding_seen` (Supabase) — источник истины, синхронизируется при монтировании
- Привязка к userId через props из серверного layout

## Типы

- `OnboardingStep` — id, target (null = модалка), extraTargets? (доп. элементы для подсветки в том же шаге), title, description, placement, onBeforeShow?
- `OnboardingTour` — pageSlug + steps[]
- `OnboardingRecord` — startedAt, completedAt?, skippedAt?

## Компоненты

- `OnboardingProvider` — context, управление активным туром, автозапуск по pathname. Должен оборачивать и Sidebar, и main, чтобы `useOnboardingContext()` был доступен в Sidebar-кнопке запуска тура
- `OnboardingSpotlight` — overlay + highlight + tooltip с кнопками «Далее» / «Пропустить»
- `OnboardingDevPanel` — dev-only панель ручного запуска любого тура. Список туров строится из реестра `TOURS` (новые туры появляются автоматически), подписи слугов — в локальной мапе `SLUG_LABELS`, текущая страница — через `getPageSlugWithFallback`

## Ручной запуск

Sidebar рендерит кнопку «Запустить онбординг» под ссылкой «Справка». Slug текущей страницы определяется через `getPageSlugWithFallback(pathname)` — точное совпадение по `PAGE_SLUG_MAP` плюс префиксное (нужно для вложенных маршрутов `/help/<slug>`, `/admin/users/<id>`). Если slug не найден — кнопка скрыта. Клик вызывает `startTour(slug)` из контекста.

## Page slug resolver

`src/modules/onboarding/page-slug.ts` — единый источник правды для `PAGE_SLUG_MAP`:
- `getPageSlug(pathname)` — точное совпадение + `PAGE_SLUG_PATTERNS` (regex для динамических маршрутов), используется автозапуском
- `getPageSlugWithFallback(pathname)` — точное + паттерны + префиксное, используется Sidebar-кнопкой. Более длинные пути проверяются первыми (`/admin/users` раньше `/admin`)
- `PAGE_SLUG_PATTERNS` — массив `{ pattern, slug }` для маршрутов без точного совпадения (например, `/admin/help/<slug>/edit` → `admin-help-edit`). Проверяется после точного совпадения и до префиксного

## Туры

Реестр туров — массив `TOURS` в `OnboardingProvider.tsx`. Лотерея скрыта (`[LOTTERY HIDDEN]`): и slug в `PAGE_SLUG_MAP`, и `adminLotteryTour` закомментированы.

### Пользовательские
- `dashboard` — 15 шагов (welcome, баланс, календарь, стрик, мастер планирования, напоминания — `alarms-widget`, благодарности, операции, лидерборд, контест, AI-ассистент — глобальная кнопка `chat-assistant`, обратная связь — глобальная кнопка `feedback-button`, запрос выходного — через `onBeforeShow` переходит на `/day-off`, подсвечивает `day-off-type-switch` + пункт сайдбара `sidebar-day-off` (`extraTargets`), справочник начислений — через `onBeforeShow` переходит на `/help/coins-reference` и подсвечивает `help-article`, финал). Отдельного тура `/day-off` нет — раздел объясняется здесь
- `achievements` — 5 шагов (grid, ranking block, gratitude block, trophy shelf, ссылка «Все достижения» — `achievements-all-link`). Отдельного тура для `/achievements/all` нет
- `store` — 3 шага (каталог, карточка, кнопка «Мои заказы» — `store-my-orders`). Шаг лотереи закомментирован
- `activity` — 4 шага (welcome, вкладки компания/отдел/команда — `feed-tabs` в `FeedTabSwitcher`, ссылка «Все достижения» — `activity-all-achievements-link`, ссылка «Все благодарности» — `activity-all-gratitudes-link`). Отдельных туров для вкладок отдела/команды и страниц `/activity/achievements`, `/activity/gratitudes` нет
- `transactions` — 5 шагов (welcome, итоговый баланс, фильтры, список, первая операция)
- `help` — тур страницы справки

### Админ-панель
- `admin` — 1 шаг (навигация по разделам)
- `admin-users` — 2 шага (таблица сотрудников, управление правами)
- `admin-products` — 4 шага (курс кристаллов — `admin-rate-current` + `admin-rate-new` (`extraTargets`), без блока статистики, категории — `onBeforeShow` разворачивает аккордеон через `[data-onboarding-trigger="admin-categories-toggle"]`, инлайн-фильтр — `admin-products-filter`, товары и inline-редактирование)
- `admin-orders` — 1 шаг (статусы, отмена с возвратом)
- `admin-events` — 2 шага (типы событий, пороги достижений)
- `admin-calendar` — 1 шаг (клик-переключение дней)
- `admin-achievements` — 1 шаг (мониторинг прогресса)
- `admin-help` — 1 шаг (редактирование статей справки)
- `admin-help-edit` — 5 шагов (редактор статьи: формат Markdown + подсказка про ИИ, переменные, кнопка предпросмотра, флажок «Опубликована», модалка про «Обновить чанки» для чат-бота — кнопка появляется только после сохранения, поэтому шаг модальный `target=null`). Динамический маршрут `/admin/help/<slug>/edit` (и `/admin/help/new/edit`) — slug определяется через `PAGE_SLUG_PATTERNS` в `page-slug.ts`, а не точным совпадением. Программной навигации нет (нет канонического URL), запуск из dev-панели работает, когда уже открыт редактор
- `admin-day-off` — 1 шаг (welcome: модерация заявок, авто-одобрение). Инструкция по проверке заявок вынесена на саму страницу (AdminDayOffInstructions)
- `admin-economy` — 7 шагов (welcome, фильтр периода, курс кристалла, сводка KPI, расходы, группа риска, топы)
- `admin-feedback` — 5 шагов (welcome, шапка, таблица, строка-шапка с выбором, строка)
- `admin-chatbot` — 4 шага (welcome, реэмбеддинг, список статей, статья со статусом и счётчиком чанков)
- `admin-shields` — 5 шагов (welcome, шапка, таблица, строка, колонка «Защищённая дата»)
- `admin-lottery` — 1 шаг (создание розыгрыша) — **скрыт**

## Actions

- `getOnboardingSeenSlugs(userId)` — возвращает `string[]` из `profiles.onboarding_seen`; вызывается один раз при монтировании провайдера
- `markTourSeenInDb(userId, pageSlug)` — добавляет slug в массив; вызывается в фоне параллельно с записью в localStorage

## Ограничения

- Если БД недоступна при холодном старте — провайдер работает только с localStorage (тур может повториться, но не сломает UI)
- Sidebar-balance target находится вне `<main>`, но доступен через `document.querySelector`
- Шаг пропускается если target не найден за 3 секунды

## Тестирование (dev mode)

- `?onboarding=reset` — сбросить все туры
- `?onboarding=reset:dashboard` — сбросить конкретный
- `?onboarding=start:dashboard` — принудительно запустить
- `?onboarding=start:dashboard:3` — запустить с конкретного шага (индекс с 0, клампится к границам)

Dev-панель (`OnboardingDevPanel`, только в development): у тура с >1 шагом справа кнопка-раскрытие — показывает список шагов по заголовкам, клик по шагу запускает тур с этого индекса (`startTour(slug, stepIndex)`). Клик по названию тура — запуск с нуля. `startTour` экспортируется через контекст и клампит индекс к диапазону шагов.
