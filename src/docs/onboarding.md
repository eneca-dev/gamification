# onboarding

Интерактивный постраничный онбординг для новых пользователей.

## Логика работы

При первом визите на страницу автоматически запускается пошаговый тур с подсказками. Каждый шаг подсвечивает целевой элемент (box-shadow spotlight) и показывает tooltip с описанием. Покрыты все пользовательские страницы и admin-панель (8 подстраниц).

Тур показывается **один раз** — запись в localStorage при старте гарантирует это. Закрытие вкладки, пропуск или прохождение до конца — всё записывает результат.

Поток:
1. `OnboardingProvider` в layout.tsx слушает `usePathname()`
2. При смене route → проверяет localStorage (`onboarding_v1:{userId}:{pageSlug}`)
3. Если записи нет → задержка 1.5с (ждём рендер) → записывает `startedAt` → запускает тур
4. Target-элементы находятся по `data-onboarding="step-id"` атрибутам
5. Если target не найден за 3 сек → шаг пропускается (условные элементы вроде лотереи)

## Зависимости

- `framer-motion` — анимация tooltip
- `lucide-react` — иконки кнопок
- `localStorage` — хранение состояния прохождения
- Привязка к userId через props из серверного layout

## Типы

- `OnboardingStep` — id, target (null = модалка), title, description, placement
- `OnboardingTour` — pageSlug + steps[]
- `OnboardingRecord` — startedAt, completedAt?, skippedAt?

## Компоненты

- `OnboardingProvider` — context, управление активным туром, автозапуск по pathname
- `OnboardingSpotlight` — overlay + highlight + tooltip с кнопками «Далее» / «Пропустить»

## Туры

### Пользовательские
- `dashboard` — 11 шагов (welcome, баланс, календарь, стрик, мастер планирования, задания, благодарности, операции, лидерборд, контест, финал)
- `achievements` — 4 шага (grid, ranking block, gratitude block, trophy shelf)
- `store` — 3 шага (каталог, карточка, лотерея — условный)
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

## Ограничения

- localStorage: теряется при очистке браузера (тур покажется повторно)
- Не синхронизируется между устройствами
- Sidebar-balance target находится вне `<main>`, но доступен через `document.querySelector`
- Шаг пропускается если target не найден за 3 секунды

## Тестирование (dev mode)

- `?onboarding=reset` — сбросить все туры
- `?onboarding=reset:dashboard` — сбросить конкретный
- `?onboarding=start:dashboard` — принудительно запустить
