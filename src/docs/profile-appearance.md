# Бимо: главная страница и гардероб магазина

План гардероба и магазина v2: [согласованный план](../docs-features/profile-appearance/plan.md),
[стандарт графики](../docs-features/profile-appearance/graphics-standard.md).
Таблицы и SQL-функции подготовлены; серверные операции и интерфейс подключены.
Публикация коллекции остаётся отдельным этапом. Реальные покупки/надевание ещё
требуют ручной проверки в согласованной тестовой среде.

Тестовая страница `/profile`, ссылка, `BimoLab` и её режимы покадрового просмотра,
группового запуска и увеличения удалены по решению пользователя. Проверка образов
продолжается в магазине. `BimoPortrait`, `scenes.ts` и `public/profile/` — общие
ресурсы магазина и Бимо в боковом меню, они сохранены. Путь статических изображений
`/profile/...webp` не является страницей профиля и продолжает использоваться.

## Бимо в боковом меню

`BimoCompanion` монтируется `Sidebar` над блоком баланса — для пользователя
с ws user ID и только в развёрнутом меню; в свёрнутом (68 px) сценка не рендерится.
Экземпляр один на всё приложение и виден на всех страницах, а не только на главной.
Перетаскивание, fixed-слой и Portal не используются: сценка стоит в потоке меню.

Единственное управление — нажатие на персонажа: каждое нажатие проигрывает
следующее движение по кругу (кофе → презентация → кристалл). Индекс движения
растёт в обработчике нажатия, поэтому начальное состояние — последнее движение;
поза покоя от выбранного движения не зависит. Нажатия во время проигрывания
игнорируются и движение не переключают. Переключение по кругу задаёт
`BimoCompanion` через необязательный `onPlay` у `BimoPortrait`; магазин этот
коллбэк не передаёт и продолжает управлять движением своим селектором.

Кнопка «Бимо ···» и её меню (выбор движения, ссылка на гардероб, скрытие,
сообщение об ошибке загрузки) удалены. Скрыть Бимо из бокового меню больше нельзя,
ключ `bimo-position:v1:<wsUserId>` в localStorage не читается и не пишется —
ранее скрытый Бимо снова виден. Гардероб открывается из магазина, вкладка Бимо.
При ошибке загрузки экипировки по-прежнему без текста показывается базовый Бимо.

## Общая графика для галереи

`index.client.ts` — клиентобезопасный API модуля: `BimoPortrait`, `bimoLook`,
`bimoThumbLayers`, геометрия холста и константы очков. Через него графику использует
модуль `bimo-gallery` (`src/docs/bimo-gallery.md`), не трогая серверные queries.

`bimoThumbLayers(look)` в `scenes.ts` отдаёт статичную позу покоя тремя слоями
изображений вместо Canvas: фон, портрет костюма и портретный слой аксессуара с аффинной
правкой по точкам глаз (в CSS — `transform-origin` на середине глаз классического Бимо
плюс `translate`/`rotate`/`scale` в процентах слоя). Круглые очки растрового файла не
имеют, поэтому для превью они повторены SVG с теми же числами и цветами
(`GLASSES_STROKE`, `GLASSES_FILL`). Размеры холста вынесены в `BIMO_CANVAS_WIDTH`/
`BIMO_CANVAS_HEIGHT`/`BIMO_PORTRAIT_CELL`/`BIMO_PORTRAIT_OFFSET_Y` — `BimoPortrait`
и превью берут их из одного места.

## Гардероб и магазин

`/store?tab=bimo`: одежда, аксессуары, фоны, фильтр купленных вещей и текущий образ.
Базовые костюм/фон и отсутствие аксессуара доступны всем. Выбор постоянного образа
хранится через новые SQL-функции, отдельно от локальных координат.

В development карточки поддерживаемых вещей дополнительно имеют «Примерить».
Проба меняет только локальный React state магазина; не покупает вещь, не вызывает
запись экипировки и не переносится на главную. В блоке «Примерка без сохранения»
можно проверить все три движения, затем вернуть действующий образ. Production
этих контролов не показывает. Тестовая страница профиля не восстанавливается.
Лавандовый свитер «Творческое настроение» подключён к примерке с портретом,
тремя движениями и отдельным магазинным изображением; товар остаётся черновиком.
Голубые наушники подключены как отдельные прозрачные слои портрета и трёх
движений с собственным магазинным превью. Примерка заменяет очки в единственном
слоте аксессуара; записи в БД для этого не нужны.
Синий бомбер «Городской» (`outfit.blue_bomber`) также поддерживает локальную
примерку с портретом, тремя движениями и отдельным превью; товар не публиковался.
Мятная кепка (`accessory.mint_cap`) подключена к примерке с отдельными слоями
портрета/трёх движений и магазинным превью; заменяет другой аксессуар в одном слоте.
Коллекция укомплектована 2026-11-10: рубашка «Отпуск», лавандовый берет,
короткий коралловый шарфик, пляж и звёздный вечер также подключены. Синяя
шапочка исключена: после проверки отсутствия заказов/экипировки/розыгрышей
её черновик и связь каталога удалены одной транзакцией через Supabase MCP.
Остальные 16 товаров неактивны и не выпущены; цены и схема не менялись.

В production раздел по умолчанию закрыт. Серверный `BIMO_V2_ENABLED=true` — флаг
будущего выпуска; в рамках реализации он не включался. Локально видны черновики,
но купить невыпущенный/неактивный товар нельзя. Неизвестная рендереру графика
также недоступна для покупки/надевания. Для пиджака, худи и очков подключены
отдельные WebP-превью из `public/profile/shop/` через `BIMO_SHOP_PREVIEWS`.
Мятный, персиковый, лавандовый и облачный фоны используют свои runtime-файлы
как магазинные изображения. Мятный — базовый фон для пустого слота; платные
персиковый и лавандовый остаются неактивными черновиками.
«Уютный офис» (`background.office`) и «Зелёный дворик» (`background.green_courtyard`)
также подключены к локальной примерке; каждый использует один прозрачный WebP
600×500 и в сцене, и в карточке. Публикация товаров не выполнялась.
Все 16 платных черновиков имеют готовую графику и магазинные изображения;
бесплатные костюм/мятный фон также имеют превью. [Графический план](../docs-features/profile-appearance/artwork-plan.md)
содержит итоговые файлы, проверки и ручные сценарии. Последние четыре товара
ожидают визуальной проверки пользователя; публикация не разрешена.

`getBimoState` проверяет пользователя, точный товар и исходный fulfilled-заказ
без возврата. При недействительном владении, невыпущенном каталоге или ошибке
загрузки отображается базовый Бимо. Обычная витрина исключает товары каталога Бимо;
обычный обработчик покупки запрещает их покупать в обход новой SQL-функции.
Пользователь берётся из серверной сессии, клиентский user ID для записи не принимается.

Ключ кеша — `queryKeys.bimo.user(wsUserId)` через существующие фабрики cache.
Покупка обновляет bimo/balance/orders, смена образа — bimo. Существующая подписка
на новые транзакции обновляет также bimo (в том числе при возврате); повторная
проверка выполняется при монтировании и фокусе окна. Новые SQL-подписки не нужны.

## Проверки реализации — 2026-11-06

TypeScript и production-сборка прошли. 16 локальных проверок с подставными
ответами подтвердили фильтрацию владения/возвратов/черновиков и серверную
идентификацию пользователя; они не обращались к Supabase и не проверяют SQL-транзакции.
Проверки с подставными Image подтвердили переиспользование, лимиты кеша и повтор
после ошибки. Кеш удерживает до 5 изображений / примерно 24 МиБ декодированных
пикселей; активный проигрыватель и внутренний кеш браузера могут занимать больше.

Линтер изменённых модулей прошёл; в Sidebar остаются две подтверждённые исходной
версией ошибки set-state-in-effect в логике бейджа выходных. Браузер не использовался.
Все визуальные/интерактивные сценарии проверяет пользователь по плану.

## Графика и воспроизведение

В `public/profile/` находятся девять исходных файлов персонажа/облаков,
три первых магазинных превью, три статичных фона, пять файлов свитера и пять
файлов наушников, пять файлов бомбера, пять файлов кепки, два фона офиса/дворика,
пять файлов рубашки, по пять файлов берета/шарфика и два последних фона
пляжа/вечера (54 WebP всего):

- `bimo-portrait.webp` и `outfits/hoodie-portrait-v2.webp` — статичные портреты 512×512;
- `bimo-{coffee,present,crystal}.webp` — три движения классического Бимо;
- `outfits/hoodie-{coffee,present,crystal}-v2.webp` — три движения Бимо в худи;
- `sky-clouds.webp` — неподвижный фон 600×500.
- `shop/{classic,hoodie,round-glasses}-v1.webp` — отдельные магазинные предметы,
  прозрачные статичные изображения 512×512; не участвуют в анимации.
- `backgrounds/{mint,peach,lavender}-v1.webp` — фоны 600×500; используются также
  карточками без дублирования. `BIMO_BACKGROUNDS` задаёт пути отрисовки.
- `backgrounds/{office,green-courtyard}-v1.webp` — офис и дворик, статичные
  прозрачные фоны 600×500, также используемые карточками магазина.
- `outfits/lavender-sweater-{portrait,coffee,present,crystal}-v1.webp` — портрет
  свитера 512×512 и три листа по 16 кадров с обычными размерами ячеек;
- `shop/lavender-sweater-v1.webp` — отдельный свитер для карточки 512×512.
- `accessories/blue-headphones-{portrait,coffee,present,crystal}-v1.webp` —
  прозрачный портретный слой 512×512 и три листа аксессуара в общей сетке;
- `shop/blue-headphones-v1.webp` — отдельные наушники для карточки 512×512.
- `outfits/blue-bomber-{portrait,coffee,present,crystal}-v1.webp` — портрет
  бомбера 512×512 и три листа по 16 кадров с общими размерами ячеек;
- `shop/blue-bomber-v1.webp` — отдельный бомбер для карточки 512×512.
- `accessories/mint-cap-{portrait,coffee,present,crystal}-v1.webp` — прозрачный
  портретный слой 512×512 и три листа кепки в общей сетке;
- `shop/mint-cap-v1.webp` — отдельная кепка для карточки 512×512.
- `outfits/coral-shirt-{portrait,coffee,present,crystal}-v1.webp` и
  `shop/coral-shirt-v1.webp` — портрет, три движения рубашки и отдельная вещь.
- `accessories/{lavender-beret,coral-scarf}-{portrait,coffee,present,crystal}-v1.webp`
  и `shop/{lavender-beret,coral-scarf}-v1.webp` — слои и отдельные превью аксессуаров.
- `backgrounds/{beach,starry-evening}-v1.webp` — статичные фоны 600×500,
  используются также карточками без дублирования.

Каждое движение — обычное изображение с 16 позами в сетке 4×4, а не анимированный
WebP. Размер ячейки для кофе — 256×256, презентации — 384×256, прыжка — 384×320.
Во всех костюмах сетка, число кадров и расписание одного движения совпадают.
Статичные портреты и фон не дублируются до 16 кадров.

Порядок отрисовки: **фон → Бимо в выбранном костюме → один аксессуар**.
Файлы худи `-v2` содержат полного персонажа с одеждой и реквизитом. Отдельные
слои одежды нужны только при подготовке графики. Очки рисуются Canvas по двум
опорным точкам глаз для каждой позы в `scenes.ts`; при моргании оправа остаётся
на месте. Фон не следует за прыжком персонажа.

`bimoLook` и `BimoPortrait` используют один `accessory`: `none`, `round-glasses`,
`blue-headphones`, `mint-cap`, `lavender-beret` или `coral-scarf`.
Растровые пути задаёт `BIMO_RASTER_ACCESSORIES`. Наушники, кепка, берет и шарфик
отрисовываются из синхронного листа с поправкой по опорным точкам выбранного
костюма; отдельные комбинации одежды и аксессуара не создаются. Один цикл
анимации управляет обоими слоями. Дополнительно загружаются только портрет
аксессуара и выбранный лист движения, без предзагрузки остальных движений.
Кеш сохраняет прежние пределы; активный проигрыватель и кеш браузера в этот
предел не входят.

Для свитера `bimoEyes` выбирает проверенные координаты оправы по образу и кадру;
классический Бимо и худи сохраняют прежние точки. Распознавание выполнялось
только локальным инструментом подготовки, runtime использует готовые числа.
Бомбер использует свои `BLUE_BOMBER_EYES` для портрета и всех трёх движений;
они применяются и к Canvas-очкам, и к коррекции растровых аксессуаров.
Рубашка использует свои `CORAL_SHIRT_EYES` для тех же целей. Шарфик имеет
короткие концы слева над грудью; его слой заранее совмещён с нижней частью
шеи каждой позы. Посадка и свободные лапы/чашка проверены на статичных листах.

`BimoPortrait` использует холст 384×320, показываемый в размере 180×150 CSS px;
портрет внутри занимает 120×120 CSS px. Движение запускается нажатием на персонажа;
выбор одного из трёх движений доступен в меню Бимо на главной.
Кадры меняются целиком, без смешивания соседних поз. После завершения движения
или скрытия вкладки воспроизведение останавливается. Листы загружаются по мере
необходимости и переиспользуются между экземплярами; при ошибке доступен повтор.

В исправленном худи задняя стенка капюшона скрыта за шеей: спереди видны белая
шерсть, низкий край горловины и шнурки. Правка ограничена областью горловины
в портрете и всех 48 кадрах; остальная видимая графика сохранена. Параметр
`v=neckline-1` в URL худи отличает исправленные изображения в браузерном кеше.

## Локальный архив подготовки

`.local-assets/profile-appearance/` исключён из Git и не раздаётся приложением:

- `sources/` — исходные отдельные слои и файлы `raw`;
- `before-hood-fix/` — копии четырёх используемых WebP до исправления;
- `previews/` — прежние PNG и новые покадровые предпросмотры;
- `candidates/` — результат imagegen для горловины, исправленные листы и отчёт;
- `tools/` — исторический скрипт подгонки и локальный инструмент исправления;
- `manifest.json` — SHA-256 перенесённых файлов и резервных копий.

Архив существует только в этой локальной копии проекта. Для работы страницы
он не требуется. В нём ничего не удалено; исторический `fit-outfit.cjs` сохранён
как исходный материал и содержит прежние пути. Новый `fix-neckline.cjs` запускается
из корня проекта, пишет только в архив и не заменяет публичные файлы сам.

Финальную проверку в магазине и на главной выполняет пользователь: покой и три движения
без очков и с очками, при необходимости с увеличением браузера. Ожидается естественная горловина,
сохранённые лапы и реквизит, неподвижный фон и возврат к портрету.
Покупки/сохранение выбора относятся к постоянному гардеробу; черновики не публикуются ради проверки.

## Подготовка кадров

Кадры созданы встроенным imagegen по утверждённому `bimo-portrait.webp`.
Границы кадров выровнены по высоте и левой границе силуэта; результат упакован
в WebP с прозрачностью. Полный исходный запрос генерации:

<details>
<summary>Запрос imagegen</summary>

Use case: illustration-story. Asset type: production 2D character animation sprite sheet. Create ONE perfectly regular 4 columns by 4 rows sprite sheet (16 frames), square canvas, transparent background. Each of the 16 equal square cells contains the SAME full-body Bimo raccoon from the reference at EXACTLY the same size, registered position, feet baseline and viewpoint. Maintain the exact reference identity and clean black outlined illustration: white fur, emerald green raccoon cheek mask and eyebrows, fluffy cheek tufts, big green-and-white striped tail on viewer left, charcoal office jacket with green lapels and badge lanyard. No panels, no grid lines, no text or numbering. Leave transparent padding in every cell, never overlap cell boundaries. Lock head silhouette, torso, feet and tail across ALL frames; only eyelids and viewer-right forearm and cup move. The full-body silhouette must be identical to reference with both feet fully visible. Animation reading order left-to-right top-to-bottom: frame1 standing reference neutral hands down; frame2 eyelids half close; frame3 eyes fully closed blink; frame4 eyes open with small beige coffee cup now in viewer-right paw at hip; frame5 cup at waist; frame6 cup at chest; frame7 cup midway from chest toward mouth; frame8 cup near mouth; frame9 cup touching mouth; frame10 eyes gently closed sipping with cup tilted only slightly; frame11 same sip; frame12 cup slightly lowered and eyes open; frame13 cup at chest; frame14 cup at waist; frame15 cup back at hip; frame16 exact same neutral no-cup standing as frame1. Make anatomical arm transitions continuous and keep cup held firmly by paw. This is a single registered animation sequence, not different character variations or a collage. Uniform square cells. Crisp art readable at 120px, medium thin consistent black outlines matching reference. No shadows, scenery or other objects. Target sheet 2048x2048 pixels.

</details>

<details>
<summary>Запрос imagegen: детали презентации</summary>

Use case: precise-object-edit. Edit this existing 16-frame Bimo presentation animation sprite sheet to add a few polished presentation details. STRICTLY preserve the exact 4 columns x4 rows landscape-cell layout, full canvas1536x1024, all character silhouettes, scales, locations, feet anchors, facial expressions, frame order, and arm movement from the input. Keep transparent background, no opaque or gray backdrop. Change only presentation details: (1) Add a slim dark presentation pointer held naturally in the raised viewer-right paw during the pointing frames; the pointer extends to the chart and lowers with the arm in the later frames. In the neutral frames the pointer is lowered beside the paw, not floating. (2) Refine the EXISTING screen with a thin green header strip, very pale fine horizontal chart grid lines and visible chart axes, keeping the original three chunky green/yellow bars and rising green line with round dots. No text or tiny fake lettering. (3) Add one small compact white-and-dark projector with a blue-green circular lens below the screen on a small low stand, arranged to the right of Bimo's feet without hiding either the feet or screen tripod. Tiny soft translucent light beam toward the screen. The projector and screen remain exactly stationary across every frame. Keep enough transparent margin around every cell, no cell overlap. The extra details should look intentional and readable as small icon-sized props, not clutter. Maintain exact character identity and original clean black-outline white/emerald-green style. Do not redraw the character or change its pose. Export an actual transparent sprite sheet.

</details>

<details>
<summary>Запрос imagegen: презентация</summary>

Use case: illustration-story. Asset type: 2D sprite sheet for Bimo giving a presentation. Create ONE precisely regular 4 column by 4 row sheet, 16 equal LANDSCAPE cells, total canvas landscape 3:2 aspect ratio target1536x1024. Transparent background, no panels, grid lines or labels. Match the reference Bimo's exact white emerald-green raccoon identity: fluffy pointed cheek tufts, green eye mask and eyebrows, black ink outlines, striped green-white tail on viewer left, black office jacket green lapels and badge. Every cell MUST keep the SAME character scale, silhouette, head size, feet baseline, anchor and camera; no new angle or zoom. Within every landscape cell, full-body Bimo stands on the LEFT two-thirds, feet and ears fully visible; the RIGHT third contains a SMALL presentation screen on a slim tripod stand slightly behind him. Keep the screen top lower than Bimo's ears and screen feet aligned with Bimo's feet. The chart is a simple green and yellow 3-bar chart and one upward line, no letters or text. Screen must stay absolutely fixed across all frames, chart identical. Character doesn't walk. Animate only viewer-right arm to point at the chart, gentle head turn toward screen, tiny mouth changes to imply explaining. Reading order: 1 neutral standing both arms down, friendly closed mouth, screen visible; 2 right forearm begins lifting; 3 arm lifts a little more; 4 elbow bent palm begins to open; 5 open palm at waist angled toward screen; 6 palm at chest; 7 arm extending toward lower chart; 8 arm points toward upper chart, small open smile; 9 holds gesture and mouth nearly closed; 10 holds gesture mouth open; 11 holds gesture mouth closed and eyes gently blink; 12 eyes open palm starts returning; 13 forearm lowers to chest; 14 hand lowers to waist; 15 hand almost down; 16 exact same neutral pose as frame1. Natural paws, no human fingers, no pointer stick, no cup. Crisp polished drawn artwork consistent with reference. Lock torso, legs, tail and face identity to prevent jitter. Leave transparent margins in each cell and keep every drawing entirely inside its cell.

</details>
