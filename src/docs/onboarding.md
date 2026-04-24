# onboarding

Интерактивный постраничный онбординг для новых пользователей.

## Логика работы

При первом визите на страницу автоматически запускается пошаговый тур с подсказками. Каждый шаг подсвечивает целевой элемент (box-shadow spotlight) и показывает tooltip с описанием. Покрыты все пользовательские страницы и admin-панель (9 подстраниц).

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

- `OnboardingStep` — id, target (null = модалка), title, description, placement, onBeforeShow?
- `OnboardingTour` — pageSlug + steps[]
- `OnboardingRecord` — startedAt, completedAt?, skippedAt?

## Компоненты

- `OnboardingProvider` — context, управление активным туром, автозапуск по pathname. Должен оборачивать и Sidebar, и main, чтобы `useOnboardingContext()` был доступен в Sidebar-кнопке запуска тура
- `OnboardingSpotlight` — overlay + highlight + tooltip с кнопками «Далее» / «Пропустить»

## Ручной запуск

Sidebar рендерит кнопку «Запустить онбординг» под ссылкой «Справка». Slug текущей страницы определяется через `getPageSlugWithFallback(pathname)` — точное совпадение по `PAGE_SLUG_MAP` плюс префиксное (нужно для вложенных маршрутов `/help/<slug>`, `/admin/users/<id>`). Если slug не найден — кнопка скрыта. Клик вызывает `startTour(slug)` из контекста.

## Page slug resolver

`src/modules/onboarding/page-slug.ts` — единый источник правды для `PAGE_SLUG_MAP`:
- `getPageSlug(pathname)` — точное совпадение, используется автозапуском
- `getPageSlugWithFallback(pathname)` — точное + префиксное, используется Sidebar-кнопкой. Более длинные пути проверяются первыми (`/admin/users` раньше `/admin`)

## Туры

### Пользовательские
- `dashboard` — 11 шагов (welcome, баланс, календарь, стрик, мастер планирования, благодарности, операции, лидерборд, контест, справочник начислений — через `onBeforeShow` переходит на `/help/coins-reference` и подсвечивает `help-article`, финал)
- `achievements` — 4 шага (grid, ranking block, gratitude block, trophy shelf)
- `store` — 3 шага (каталог, карточка, лотерея — третий шаг через `onBeforeShow` переключает фильтр на «Розыгрыш», чтобы отрендерился `LotteryBanner`)
- `activity` — 1 шаг (лента)
- `master-planner` — 2 шага (шапка с прогрессом, фильтры)

### Админ-панель
- `admin` — 1 шаг (навигация по разделам)
- `admin-users` — 2 шага (таблица сотрудников, управление правами)
- `admin-products` — 2 шага (категории, inline-редактирование товаров)
- `admin-orders` — 1 шаг (статусы, отмена с возвратом)
- `admin-events` — 2 шага (типы событий, пороги достижений)
- `admin-calendar` — 1 шаг (клик-переключение дней)
- `admin-achievements` — 1 шаг (мониторинг прогресса)
- `admin-lottery` — 1 шаг (создание розыгрыша)
- `admin-help` — 1 шаг (редактирование статей справки)

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
