# Онбординг — план реализации

## Архитектура

### Модуль
```
src/modules/onboarding/
  types.ts              — OnboardingStep, OnboardingTour, OnboardingRecord
  storage.ts            — localStorage: isTourSeen(), markTourStarted(), resetTour()
  components/
    OnboardingProvider.tsx  — React context, pathname watcher, auto-start
    OnboardingSpotlight.tsx — overlay + highlight (box-shadow trick) + tooltip
  tours/
    dashboard.ts        — 10 шагов
    achievements.ts     — 4 шага
    store.ts            — 3 шага (лотерея — условный)
    activity.ts         — 1 шаг
  index.client.ts       — экспорт OnboardingProvider
```

### Принцип работы
1. `OnboardingProvider` монтируется в `(main)/layout.tsx`, получает `userId` из серверного layout
2. При mount и при смене `usePathname()` — проверяет localStorage: есть ли запись `onboarding_v1:{userId}:{pageSlug}`
3. Если записи нет и есть конфиг тура для текущей страницы → записывает `startedAt` в localStorage → запускает тур
4. Если запись есть → ничего не делает

### Гарантия «не больше 1 раза»
- Запись в localStorage происходит **при старте**, не при завершении
- Ключ: `onboarding_v1:{userId}:{pageSlug}` → `{ startedAt, completedAt?, skippedAt? }`
- Если ключ существует — тур не показывается. Закрытие вкладки на середине → запись уже есть
- Два таба одновременно: запись синхронная перед первым шагом → второй таб увидит запись

### Spotlight механика
- Целевой элемент: `z-index: 10001` + `box-shadow: 0 0 0 9999px rgba(0,0,0,0.5)` + `border-radius: 12px`
- Overlay div: `z-index: 10000`, ловит клики, предотвращает скролл
- Tooltip: позиционируется через `getBoundingClientRect()` целевого элемента
- Если элемент за пределами viewport → `scrollIntoView({ behavior: 'smooth', block: 'center' })`
- Если target не найден в DOM за 3 сек → пропуск шага (важно для условных элементов типа лотереи)

### Tooltip UI
- Заголовок (14px bold)
- Текст (13px, max-width ~340px)
- «Далее (X/N)» — primary кнопка
- «Пропустить» — мелкая ссылка под кнопкой
- Крестик в углу = пропустить
- На последнем шаге: «Понятно» вместо «Далее»
- Анимация: Framer Motion fade + slide

### Тестирование (dev mode)
- `?onboarding=reset` — сбросить все туры
- `?onboarding=reset:dashboard` — сбросить конкретный тур
- `?onboarding=start:dashboard` — принудительный запуск
- Работает только при `NODE_ENV === 'development'`

---

## Туры и шаги

### Dashboard (/) — 10 шагов

| # | target | placement | Заголовок | Текст |
|---|--------|-----------|-----------|-------|
| 0 | null (модалка) | center | Добро пожаловать в Систему баллов! | Вы зарабатываете проект-коины за дисциплину в Worksection, использование Revit-плагинов и помощь коллегам. Коины можно потратить в магазине на реальные награды. Давайте познакомимся с основными элементами! |
| 1 | `sidebar-balance` | right | Ваш баланс | Текущее количество проект-коинов. Коины начисляются автоматически каждый день за выполнение задач, а также за стрики, благодарности и достижения. Потратить их можно в разделе «Магазин». |
| 2 | `streak-calendar` | bottom | Календарь активности | 🟢 Зелёный — все задачи в Worksection выполнены вовремя. 🔴 Красный — были просрочки или не внесён отчёт. 🔵 Синий — отпуск или больничный (стрик не прерывается). ⭐ Звезда — в этот день вы использовали Revit-плагины. Наведите на любую клетку, чтобы увидеть подробности. |
| 3 | `streak-milestones` | right | Серия и защита стрика | Чем длиннее непрерывная серия зелёных дней, тем больше бонус: 7 дней — 25 коинов, 30 дней — 100 коинов, 90 дней — 300 коинов! Если случился красный день — у вас есть 24 часа, чтобы купить «Вторую жизнь» за 100 коинов в магазине и сохранить серию. Уведомление появится автоматически. |
| 4 | `daily-quests` | left | Ежедневные задания | Каждый день вам доступны задания из Worksection и Revit. За каждое выполненное — коины. Выполните все задания за день, чтобы заработать максимум. Прогресс обновляется автоматически. |
| 5 | `gratitude-widget` | left | Благодарности коллегам | Нажмите «Поблагодарить», чтобы отправить благодарность. Три варианта: бесплатное «спасибо», подарок из квоты (раз в 2 недели, бесплатно) или подарок за свой счёт. Получатель получает коины, а вы продвигаетесь к достижениям. Для достижений считаются только подарки с коинами! |
| 6 | `transaction-feed` | top | История операций | Здесь отображаются последние 5 операций: начисления за зелёные дни, стрик-бонусы, благодарности и покупки. Нажмите «Все операции» для полной истории. |
| 7 | `leaderboard` | top | Рейтинг сотрудников | Два топ-5: по Worksection (дисциплина) и по Revit (автоматизация). Рейтинг формируется по количеству баллов за месяц и обновляется ежедневно. Сотрудники в отпуске или на больничном не учитываются. Наведите на иконку ℹ️ для подробностей. Попадание в топ-10 на 10 дней — это достижение! |
| 8 | `department-contest` | top | Соревнование отделов | Ваш отдел соревнуется с другими по Worksection и Revit. Счёт учитывает не только баллы, но и долю участия сотрудников — чем больше людей из отдела активны, тем выше позиция. Итоги в конце месяца. Наведите на ℹ️ для формулы расчёта. |
| 9 | null (модалка) | center | Вы готовы! | Зарабатывайте коины, поддерживайте серию, помогайте коллегам и обменивайте баллы на награды в магазине. Загляните в «Достижения» и «Магазин» в боковом меню — там тоже будут подсказки при первом посещении. |

### Achievements (/achievements) — 4 шага

| # | target | placement | Заголовок | Текст |
|---|--------|-----------|-----------|-------|
| 1 | `achievement-grid` | bottom | Три направления достижений | Достижения зарабатываются в трёх областях: Revit-автоматизация ⚡, Worksection-дисциплина 📋 и благодарности 💜. В каждой области — личное, командное и отдельское достижение. Период — календарный месяц. |
| 2 | `ranking-block-first` | right | Как заработать достижение | Продержитесь 10 дней в топе рейтинга за месяц — и получите достижение с бонусом коинов. Личное — 200 коинов (топ-10 сотрудников), командное — 150 коинов (топ-5 команд), отдельское — 100 коинов (топ-5 отделов). Прогресс-бар показывает, сколько дней уже набрано. |
| 3 | `gratitude-block` | left | Достижения за благодарности | Получите 4 подарка с коинами в одной категории за месяц — и заработаете достижение на 200 коинов. Три категории: Поддержка 🤝, Профессионализм ⭐ и Наставничество 📚. Бесплатные «спасибо» не считаются — только подарки! |
| 4 | `trophy-shelf` | top | Полка трофеев | Здесь собраны все ваши достижения за текущий квартал. Цветная рамка — заработано, пунктирная — в процессе, серая — пока не получено. Наведите на ячейку для деталей. Нажмите «Все достижения» для полной истории. |

### Store (/store) — 3 шага

| # | target | placement | Заголовок | Текст |
|---|--------|-----------|-----------|-------|
| 1 | `store-catalog` | bottom | Магазин наград | Тратьте заработанные проект-коины на реальные награды! Товары разделены по категориям. Физические товары имеют ограниченное количество — следите за наличием. |
| 2 | `product-card-first` | right | Карточка товара | Цена указана в коинах. Если баланса хватает — нажмите «Получить». Если нет — кнопка покажет, сколько ещё нужно накопить. Товары с пометкой «Осталось: N» скоро закончатся! |
| 3 | `lottery-banner` (условный) | bottom | Ежемесячная лотерея | Каждый месяц — розыгрыш приза! Купите билет за 300 коинов. Чем больше билетов — тем выше шанс. Розыгрыш проходит 1 числа каждого месяца в 12:00. Ваш шанс рассчитывается автоматически. |

> Шаг 3 (лотерея) — условный: если `[data-onboarding="lottery-banner"]` не найден в DOM, шаг пропускается.

### Activity (/activity) — 1 шаг

| # | target | placement | Заголовок | Текст |
|---|--------|-----------|-----------|-------|
| 1 | `activity-feed` | bottom | Лента компании | Здесь видно, кто из коллег получил достижения за месяц и кто кого поблагодарил за последние 2 недели. Вдохновляйтесь успехами коллег! |

---

## data-onboarding атрибуты — куда добавить

### Dashboard виджеты
| Атрибут | Файл | Элемент |
|---------|------|---------|
| `sidebar-balance` | `src/components/Sidebar.tsx` | div.p-3.rounded-xl (блок баланса) |
| `streak-calendar` | `src/components/dashboard/StreakPanel.tsx` | левая часть (flex container с календарём) |
| `streak-milestones` | `src/components/dashboard/StreakPanel.tsx` | секция стриков под календарём (flex flex-col gap-3 pt-3) |
| `daily-quests` | `src/components/dashboard/StreakPanel.tsx` | правая часть (flex-1 min-w-0 pl-6) |
| `gratitude-widget` | `src/modules/gratitudes/components/GratitudeWidget.tsx` | внешний wrapper div |
| `transaction-feed` | `src/components/dashboard/TransactionFeed.tsx` | внешний wrapper div |
| `leaderboard` | `src/app/(main)/page.tsx` | grid div с двумя Leaderboard компонентами |
| `department-contest` | `src/components/dashboard/DepartmentContest.tsx` | внешний wrapper div |

### Achievements
| Атрибут | Файл | Элемент |
|---------|------|---------|
| `achievement-grid` | `src/app/(main)/achievements/page.tsx` | grid div с 3 блоками |
| `ranking-block-first` | `src/modules/achievements/components/AchievementBlock.tsx` | первый RankingBlock wrapper |
| `gratitude-block` | `src/modules/achievements/components/AchievementBlock.tsx` | GratitudeBlock wrapper |
| `trophy-shelf` | `src/modules/achievements/components/TrophyShelf.tsx` | внешний wrapper div |

### Store
| Атрибут | Файл | Элемент |
|---------|------|---------|
| `store-catalog` | StoreClient компонент | каталог wrapper |
| `product-card-first` | `src/modules/shop/components/ProductCard.tsx` | первая карточка (через prop?) |
| `lottery-banner` | `src/modules/lottery/components/LotteryBanner.tsx` | внешний wrapper div |

### Activity
| Атрибут | Файл | Элемент |
|---------|------|---------|
| `activity-feed` | `src/app/(main)/activity/page.tsx` | main container div |

---

## Порядок реализации

1. `types.ts` + `storage.ts` — основа
2. `OnboardingProvider.tsx` + `OnboardingSpotlight.tsx` — UI
3. `tours/dashboard.ts` — конфиг шагов
4. Интеграция: layout.tsx + data-onboarding атрибуты на dashboard виджетах
5. Тестирование dashboard тура
6. `tours/achievements.ts` + `tours/store.ts` + `tours/activity.ts`
7. data-onboarding атрибуты на остальных страницах
8. `index.client.ts` + `src/docs/onboarding.md`
