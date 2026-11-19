# Общий lint: доказательство baseline и предложение исправлений

17.11.2026. **Исправления 21 исходной ошибки не применялись.** Обязательное условие проходящего общего lint сохраняется.

## Как подтверждено происхождение

Исходный commit: `97af4b5d4ffec3189c35eda09eb1abe10aa69713`.

1. Через ESLint Node API выполнен полный `lintFiles(['.'])`: 21 error.
2. Для каждого из 17 проблемных файлов взято содержимое `git show <HEAD>:<path>` и выполнен `ESLint.lintText(text, { filePath: path })`. Получены те же 21 сообщения на тех же строках с теми же правилами. Checkout, stash и изменение Git не требовались.
3. Текущий текст каждого из этих файлов совпадает с HEAD после нормализации CRLF/LF. В evidence сохранён Git blob ID каждого исходного файла.
4. На момент сравнения `eslint.config.mjs` совпадал с HEAD; версии в исходном/текущем lockfile одинаковы: ESLint 9.39.3, eslint-config-next 16.1.6, react plugin 7.37.5, hooks plugin 7.0.1, TS parser 8.56.1.
5. Машинное доказательство: [lint-baseline-evidence.json](lint-baseline-evidence.json). Оно содержит оба набора диагностик и исходные blob ID, а не только утверждение «файл не менялся».

При первом запуске после coverage было 51 предупреждение: одно новое относилось к сгенерированному `coverage/block-navigation.js`. Оно устранено добавлением только generated-директорий coverage/playwright-report/test-results в ignore. Правила для исходного кода не менялись; текущие 50 предупреждений не входят в предлагаемый пакет. Конфигурация evidence относится к моменту **до** этой правки.

### Дополнительное подтверждение с исходным lockfile

После установки тестов изменились некоторые транзитивные Babel-пакеты. Поэтому одной первой проверки было недостаточно для доказательства одинакового окружения. Во временную папку read-only экспортированы исходные 17 файлов, eslint.config.mjs, tsconfig.json, package.json и package-lock.json. Из npm cache по исходным integrity-хешам восстановлены 342 совместимых с Windows узла зависимостей ESLint/Next/TypeScript. Lifecycle scripts не запускались, рабочие node_modules и Git не менялись. Обычный offline npm ci сначала остановился на отсутствующем zwitch из не относящейся к lint части приложения; он не считается успешной проверкой.

На восстановленном исходном lint runtime получены ровно те же 21 сообщения: файл/строка/столбец/правило полностью совпали. Полное доказательство, версии и integrity: [lint-original-lock-evidence.json](lint-original-lock-evidence.json). Это повторный lint 17 проблемных файлов с исходными зависимостями, а не сборка всего исходного приложения.

## Краткий список всех 21 ошибок

Пути ниже относительно src/.

| Файл:строка | Количество | Правило / конкретная причина |
| --- | ---: | --- |
| components/dashboard/AchievementProgress.tsx:220 | 1 | purity: Date.now при render |
| components/LayoutShell.tsx:28 | 1 | set-state-in-effect: сброс mobile menu |
| components/Sidebar.tsx:67,78 | 2 | set-state-in-effect: derived badge / lastSeen |
| modules/achievements/components/GratitudeProgress.tsx:104 | 2 | no-unescaped-entities: две кавычки |
| modules/admin/components/CalendarClient.tsx:151,175 | 2 | purity: Date.now внутри handleDayClick; ложное срабатывание render-правила |
| modules/admin/components/CrystalRateStats.tsx:41 | 1 | purity: Date.now при render |
| modules/admin/components/economy/KpiSummary.tsx:116 | 2 | no-unescaped-entities: две кавычки |
| modules/admin/components/LotteryAdmin.tsx:46 | 1 | immutability: processFile упомянут до объявления; function hoisting есть, runtime TDZ не доказан |
| modules/admin/components/UserDetailModal.tsx:19 | 1 | set-state-in-effect: loading/reset при смене сотрудника |
| modules/admin/components/UsersTable.tsx:288 | 1 | set-state-in-effect: раскрытие секции |
| modules/chat/components/ChatWindow.tsx:91 | 1 | purity: Date.now внутри handleSend; ложное срабатывание render-правила |
| modules/corrections/components/RedDayCalendar.tsx:59 | 1 | set-state-in-effect: clamp startIdx |
| modules/corrections/components/UserAppealsCard.tsx:70 | 1 | set-state-in-effect: highlight раскрывает карточку |
| modules/dev-tools/components/DevUserSwitcher.tsx:35 | 1 | set-state-in-effect: reset при открытии |
| modules/lottery/components/LotteryBanner.tsx:38 | 1 | purity: вычисление Date.now в аргументе useRef |
| modules/lottery/components/LotteryReveal.tsx:30 | 1 | set-state-in-effect: прочитанный seen/phase |
| modules/onboarding/components/OnboardingSpotlight.tsx:57 | 1 | set-state-in-effect: reset шага |
| **Итого** | **21** | **17 файлов** |

## Рекомендуемый минимальный пакет

Это предложение для отдельного согласования, не разрешение на общий рефакторинг.

- **Кавычки, 2 файла:** четыре `&quot;`, видимый текст неизменен. Низкий риск/сопровождение, механическая правка.
- **Обработчики CalendarClient/ChatWindow, 2 файла:** три точечных `eslint-disable-next-line react-hooks/purity` с объяснением, что optimistic ID создаётся только в событии. Альтернатива — перенос вычисления в helper, но это маскирует анализ и меняет структуру без пользы. Рекомендую точечные исключения плюс проверку, что обработчик не вызывается при render; глобальное правило сохранить.
- **Время, 3 файла:** один небольшой UI-clock hook со стабильным SSR snapshot и подпиской для AchievementProgress/CrystalRateStats. В LotteryBanner offset вычислять в эффекте таймера; initial countdown — из переданного serverTime. Альтернатива — заморозить Date.now в initial state: меньше работы, но устаревает длительно открытая страница. Рекомендую обновляемое время; средний риск гидратации/границ суток, низкое сопровождение общего hook.
- **LotteryAdmin:** перенести processFile выше paste-effect, при необходимости useCallback с правильными зависимостями. Минимальная перестановка; не менять upload/object URL попутно.
- **Синхронизация state, 9 файлов:** точечные изменения ниже. Средние трудозатраты/риск, зато сохраняются ожидаемые переходы. Альтернатива массового отключения правила дешевле, но оставляет лишние переходы и потенциальные гонки — не рекомендую.

| Компонент | Изменение и обязательная проверка |
| --- | --- |
| LayoutShell | Guarded reset только mobile-menu при новом pathname; Back закрывает меню, sidebar/дети сохраняют state |
| Sidebar | Badge вычисляется из данных + подписанного localStorage snapshot lastSeen; первый вход, две вкладки, отказ storage |
| UserDetailModal | Внутренняя загрузка по key userId с initial loading; async отмена/защита A→B и закрытия, ошибки |
| UsersTable | Guarded reset только local open при expandKey/defaultOpen; **не** remount всей DeptSection с team-state |
| RedDayCalendar | Сохранить clamp через guarded reset диапазона; shrink→grow не возвращает старый некорректный индекс |
| UserAppealsCard | Guarded reset expanded на новом highlight; scroll/timeout остаются DOM-эффектом с cleanup, форма сохраняется |
| DevUserSwitcher | Opening/closing resets в общих handlers, эффекты только focus/search; повторное открытие, очистка, обратный порядок ответов |
| LotteryReveal | Seen из storage snapshot, фаза для конкретного lottery ID; reload/dismiss/new ID/SSR без вспышки |
| OnboardingSpotlight | Key тура/шага либо внутренний keyed wrapper, правильные initial state; Next/Back/modal→target, timeout, cleanup/overflow |

Возможны один общий hook, focused tests и одна строка в OnboardingProvider для key; это не обещание ровно 17 изменяемых файлов. Линтер может после первого исправления показать следующий setter в том же эффекте: это учитывается в пределах перечисленных участков.

**Проверки после согласования:** тесты переходов и часов, адресный lint, общий `npm run lint` (0 errors), TypeScript и build. Не добавлять бессмысленные тесты замены кавычек. Бизнес-расчёты, рейтинги и внешние доставки этим пакетом не меняются.

**Варианты решения:** A — принять весь пакет, ориентир 1–2 инженерных дня с тестами; B — сначала механические/ложные срабатывания (7 ошибок), затем state/time (14), общий lint до второй части остаётся красным; C — оставить baseline, почти без затрат, но это блокирует согласованную приёмку. Рекомендую A. Точный diff будет проверен перед завершением; исправления пока не начаты.

