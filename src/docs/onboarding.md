# onboarding

Интерактивный постраничный онбординг для новых пользователей.

## Логика работы

При первом визите на страницу автоматически запускается пошаговый тур с подсказками. Каждый шаг подсвечивает целевой элемент (box-shadow spotlight) и показывает tooltip с описанием. Покрыты все пользовательские страницы и admin-панель (9 подстраниц).

Тур показывается **один раз** — запись в localStorage при старте гарантирует это. Закрытие вкладки, пропуск или прохождение до конца — всё записывает результат.

Поток:
1. `OnboardingProvider` в layout.tsx слушает `usePathname()`
2. При смене route → проверяет localStorage (`onboarding_v1:{userId}:{pageSlug}`)
3. Если записи нет → задержка 1.5с (ждём рендер) → записывает `startedAt` → запускает тур
4. Target-элементы находятся по `data-onboarding="step-id"` атрибутам
5. Перед поиском target вызывается `step.onBeforeShow?.({ router })` (если задан) — для подготовки DOM (переключение таба, открытие аккордеона, переход на другую страницу). Вызывается и для модальных шагов (target=null)
6. Если target не найден за 3 сек → шаг пропускается (условные элементы вроде лотереи)

## Зависимости

- `framer-motion` — анимация tooltip
- `lucide-react` — иконки кнопок
- `localStorage` — хранение состояния прохождения
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

## Ограничения

- localStorage: теряется при очистке браузера (тур покажется повторно)
- Не синхронизируется между устройствами
- Sidebar-balance target находится вне `<main>`, но доступен через `document.querySelector`
- Шаг пропускается если target не найден за 3 секунды

## Тестирование (dev mode)

- `?onboarding=reset` — сбросить все туры
- `?onboarding=reset:dashboard` — сбросить конкретный
- `?onboarding=start:dashboard` — принудительно запустить
