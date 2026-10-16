# План перехода части Revit-плагинов на Plugins Usage Analytics

Статус: **анализ и план; переключение не выполнялось**. Проверено 16 октября 2026 года. Цель — для поддерживаемых плагинов засчитывать завершённое полезное действие вместо одного лишь запуска, сохранив действующую геймификацию для плагинов без надёжной аналитики.

## 1. Текущая схема

| Часть | Подтверждённое поведение |
|---|---|
| Конфигурация | `src/config/plugins.ts` содержит 27 позиций. Одна позиция может иметь несколько технических имён и индексов. |
| Старый сбор | `gamification-vps-scripts/src/scripts/sync-plugin-launches.ts` читает 40 настроенных Elastic data streams. Фильтры: `Properties.IsEnecaUser=true`, `MessageTemplate.keyword="App successfully started"` и минский день. Агрегация по email и `Properties.AppName` записывается в `elk_plugin_launches.launch_count`. |
| Ограничение | Список ограничивает индексы, но не точные `AppName`; в БД есть имена сверх 27 позиций UI. Один запуск не подтверждает работу. Composite aggregation запрашивает 10 000 buckets без продолжения по `after_key`; неполнота ответа и ошибки шардов отдельно не проверяются. |
| Новый поток | `plugins-usage-analytics` содержит `@timestamp`, `email`, `plugin_name` и `trigger`. Там есть как результаты, так и старт, настройки, отмены. Поля `IsEnecaUser` нет. `source_id` и `source_index` объявлены в mapping, но у всех 37 229 событий проверенного окна отсутствуют. |
| Награда | `elk_plugin_launches` уникальна по `(user_email, work_date, plugin_name)`. Действующий `trg_award_revit_points` срабатывает **AFTER INSERT OR UPDATE**. Он проверяет рабочий день, активного сотрудника и отсутствие, затем создаёт дневное событие, транзакцию и баланс. Ключ `revit_green_<email>_<date>` защищает дневную награду, но повторный вызов может снова дописать плагин в `details.plugins`. |
| Фактическая цена | На дату проверки `revit_using_plugins` имеет `coins=10` и `is_active=true`. Указанные в старой документации 5 💎 устарели. `create_transaction=false` не отключает эту транзакцию: её напрямую создаёт SQL-функция. |
| Потребители | Строки таблицы дают Revit-день и стрик. `launch_count` участвует в рейтингах, достижениях, экспорте, аналитике внедрения и текстах транзакций. |

```text
Сейчас: запуск → elk_plugin_launches → SQL-триггер → день, 10 💎, стрик
План:   успешное действие ─┐
        старый запуск       ├→ проверенная дневная активность → те же правила
        (без новой аналитики)┘
```

Теневую сверку **нельзя** проводить записью в `elk_plugin_launches`: даже upsert существующей строки вызывает наградный триггер.

## 2. Срез источников

Одинаковое окно: **16.09.2026 00:00 — 16.10.2026 00:00 по Минску**, 30 завершённых дней. Ниже числа сырых событий, а не сотрудников или наград.

- Старый запрос по 40 настроенным индексам: **20 884** события запуска; около **290** уникальных email по Elasticsearch cardinality.
- Новый поток: **37 229** событий; около **268** уникальных email. Пустых `email`, `plugin_name` и `trigger` в окне нет; `source_id` и `source_index` пусты у всех 37 229.
- В новом потоке за окно 20 технических имён, за всю доступную историю — 24. `ProfiLay`, `LintelsTransfer`, `SurfaceGen` и `SDT.Updater` присутствуют только в истории.
- По `email + минский день` старый поток даёт **3 402** пары. Предварительный фильтр нового потока даёт **2 763**; совпадают **2 751**, только в старом **651**, только в новом **12**.
- Гибрид, сохраняющий старый источник для неподдерживаемых технических имён, даёт около **2 902** пар. Относительно старой схемы примерно **512** пар исчезли бы и **12** появились бы. Эти расхождения нужно разобрать как «только открытие» либо пропущенное реальное действие.
- Предварительный фильтр исключает явный старт, настройки, отмену и общий неоднозначный `Success`, но пока допускает некоторые количественные сообщения. Поэтому **2 763 — оценка покрытия, не утверждённая база начислений**. Сопоставление с активными `ws_users`, календарём и отпусками в эти числа не входит.

### Все 27 позиций текущей игровой конфигурации

«Старый» — число запусков за окно, «новый» — **все** события аналитики за окно, включая невалидные для награды. Ноль не означает отсутствие события за всю историю. Составные значения показывают разные технические имена.

| Позиция | Старый | Новый | Предварительный маршрут |
|---|---:|---:|---|
| Auditor | 683 | 1 378 | Кандидат: аудит и изменение параметра |
| ClashesManager | Revit 386, Navis 101, Server 25 | Revit 16 379, Navis 116 | Кандидат Revit/Navis; Server оставить старым |
| LinksManager | 2 519 | 5 456 | Кандидат: успешное связывание |
| ShareModel | 3 442; Civil 96 | 2 644 | Кандидат основного имени; Civil оставить старым |
| SDT | 3 426 | 2 460 | Кандидат: операции; не смена вида |
| ParamOperator | 108 | 545 | Кандидат: изменение/импорт параметров |
| ApartmentLayouts | 246 | 376 | Кандидат: расчёт/создание/нумерация |
| FasciaCappings | 390 | 331 | Кандидат: создание/корректировка |
| SpacesManager | 436 | 514 | Кандидат: завершённое создание/обновление |
| ResaveModels | 252 | 2 309 | Кандидат: `Work done` |
| AutoOpenings | 3 554 | 922 | Кандидат: успешно завершённый процесс |
| Finishing | 30 | 233 | Кандидат: создание отделки |
| SharedCoordinates | 98 | 384 | Кандидат: `Coordination done` |
| ProfiLay | 1 | 0 | Успехи есть в истории, свежих нет; пока старый |
| LookupTables | 248; алиас `Lookup Tables` 3 | 126 | Кандидат; уточнить алиас |
| ViewCloner | 104 | 67 | Кандидат: завершённое клонирование |
| LintelsTransfer | 3 | 0 | Успехи есть в истории, свежих нет; пока старый |
| SurfaceGen | 0 | 0 | Только выбор XML в истории; оставить старый |
| QuickMount | 74 | 273 | Кандидат: успешное размещение/удаление |
| SchedulesTable | 19 | 38 | Только старт и настройки; оставить старый |
| SetToRevit | 366 | 0 | Нет в новом потоке; оставить старый |
| ParkingSlots | 7 | 0 | Нет в новом потоке; оставить старый |
| FilterAssistant | 189 | 102 | Кандидат: `Filter applied` |
| HVACAutoTag | 18 | 0 | Нет в новом потоке; оставить старый |
| Evacuation | 46 | 0 | Нет в новом потоке; оставить старый |
| RevitDataExporter | 0 | 0 | Нет в новом потоке; старые запуски есть в истории |
| EnecaFamilies | Frontend 1 844, Backend 1 819 | 2 576 под общим именем | Кандидат: успешная загрузка; согласовать имя |

Итог: **18 позиций имеют свежие кандидаты** на результативное действие, ещё две (`ProfiLay` и `LintelsTransfer`) — только исторические. Остальные семь из 27 не готовы к переходу. Наличие кандидата не означает разрешение на начисление.

Из Civil-имён в старых настроенных индексах, но не в новой аналитике, за окно есть `StrucAndPipe.Civil` (183), `ModelPoint.Civil` (110), `ShareModel.Civil` (96), `IFCExchangeMaster.Civil` (47), `GroundAnalyzer.Civil` (9), `CurbGenerator.Civil` (2). Исторически есть также `MarkUpSolid.Civil`, `PipelineInsulation.Civil` и `ReplaceStyle.Civil` — без запусков за окно. Прежний список из шести Civil-имён неполон. `ReplaceStyle.Civil` попадает через настроенные индексы, хотя отдельного индекса с его названием в массиве нет.

## 3. Каталог `trigger` и правило отбора

Фильтр должен сравнивать **точное сочетание `plugin_name + trigger`**. Неизвестный `trigger` не засчитывать, а выводить в отчёт для разбора. В таблице приведены смысловые части реальных строк: полные литералы имеют вид `RenderedMessage is "Filter applied"`, `RenderedMessage contains "Visibility changed for"` или, для FasciaCappings, `MessageTemplate is "Single fascia creation finished"`. Слова `is` и `contains` — часть значения поля, а не инструкция искать свободный текст. Перед разработкой полные литералы нужно закрепить в конфигурации и тестах.

| Техническое имя | Кандидат на полезное действие | Не учитывать / проверить отдельно |
|---|---|---|
| ClashesManager.Revit | `Clash founded in`, `Successfully status items` | Проверить, что первый означает завершённый расчёт, включая нулевые коллизии |
| ClashesManager.Navis | `Create report`, `Export to server` | Проверить завершение создания отчёта |
| LinksManager | `Successful completion of revit/cad/ifc linker`; `Successful changed RVT state "Load"/"Delete"` | — |
| ShareModel | `ShareModel created` | `ShareModel creation time` может быть лишь метрикой того же действия |
| SDT | `Visibility changed for`, `Solid variant changed for`, `Updated schedules`, `Switched grids control for`, `Applied range positions to`, `UpdateSheets`, `UpdateInserted`, `UpdateHolesAndOpenings`, `UpdateSuperElements` | `Change active view` исключить; `Count connected elements`, `Clean template`, `Center of gravity was founded for` проверить |
| ParamOperator | `Parameter replaced/injected/value changed/deleted/formula changed`, `Data imported` | `Settings gathered` исключить; общий `Success` проверить |
| Auditor | `Elements audited`, `Model audited`, `Successfully set parameter in elements` | `Open settings` исключить |
| ResaveModels | `Work done` | Исторические `Share/Central/Release success total` проверить на ненулевой результат |
| FasciaCappings | `Fascia created`, `Single fascia creation finished`, `Angle adjusted` | Проверить повторы одной операции |
| SpacesManager | `Spaces created finished successfully`, `Update spaces finished successfully` | `The number of spaces created` проверить на ненулевое число |
| Finishing | `FloorCreatorSuccess`, `RoomCreatorSuccess`, `AdjacencySuccess`, `... creation done` | `Settings gathered` и `RecordsOpened` исключить; `connected with host wall` проверить |
| ApartmentLayouts | `Apartment areas calculated`, `Chess views created`, `Auto/Manual renumbering finished`, `Edit apartment number used` | Настройки и `Request for opening chess view` исключить; общий `Success` проверить |
| AutoOpenings | `Create/Merge prototypes process finished successfully` | Отмену исключить; `number of prototypes installed` проверить на ненулевое число |
| SharedCoordinates | `Coordination done`, `Files coordinated` | — |
| LookupTables | `CreatedSizeTable`, `CreatedNewTable` | — |
| ViewCloner | `ViewClone process completed` | — |
| QuickMount | `The placement process fasteners finished successfully`, `The deleting fasteners finished successfully` | Количественные сообщения проверить на ненулевое число |
| FilterAssistant | `Filter applied` | — |
| EnecaFamilies | `Families successfully loaded` | `LoadFamily's` — начало, исключить; `CreatedKit` проверить |
| ProfiLay | `Create hole process finished successfully`, `Profile layout process finished successfully`, `Profile layout completed` | Только исторические примеры; нужен свежий контрольный лог |
| LintelsTransfer | `LintelsTransfer process completed` | Только исторические примеры; нужен свежий контрольный лог |

В новом потоке есть `SDT.Updater / UpdateSheets` (33 события в истории, ни одного за окно), но отдельной позиции в 27 нет: автоматически не включать. `SchedulesTable` передаёт только `Start command executed`, `Settings loaded from file`, `Default settings applied`; `SurfaceGen` исторически передавал только выбор XML. Ни одно из этих событий не подтверждает полезный результат.

## 4. Риски и обязательные решения

1. **Право на награду.** Новый поток не имеет `IsEnecaUser`. До записи игровой активности сопоставлять нормализованный email с активным `ws_users`; сохранить проверки рабочего дня и отсутствий. Не превращать число событий в число транзакций.
2. **Смысл счётчика.** Число операций разных плагинов несопоставимо с числом запусков. Нельзя молча записать операции в `launch_count`: рейтинги, экспорт и аналитика продолжат говорить «запуски». Решить, хранить оба показателя отдельно или перейти на единую метрику, например активный плагин-день, с обновлением всех зависимых экранов и отчётов.
3. **Повторный upsert.** Триггер работает и на UPDATE. Дневной ключ защищает баланс от повторных 10 💎, но `details.plugins` может пополниться дублем. До бэкфилла/переключения исправить идемпотентность деталей и проверить повторный запуск.
4. **Время и задержка доставки.** Оба источника должны брать одно окно `[00:00+03:00, следующие 00:00+03:00)`. Измерить задержку аналитики. Догон позднего события должен быть безопасным для уже закрытого дня; исторические награды автоматически не переписывать.
5. **Покрытие и отказ источника.** Для переведённого имени нельзя при отсутствии полезного события у конкретного человека автоматически засчитать старый `App successfully started` — это вернёт исходную ошибку. Старый путь оставить только для явно неподдерживаемых имён. Ошибку/неполный ответ аналитики сигнализировать и исправлять догоном.
6. **Алиасы.** `EnecaFamilies` в аналитике объединён, старый поток различает Frontend и Backend. `ClashesManager.Server`, `ShareModel.Civil`, `Lookup Tables` и другие старые имена требуют явного решения и проверки текста UI.
7. **Полнота Elasticsearch.** Проверять `timed_out`, failed shards, все страницы и неожиданные `plugin_name/trigger`. Заполненного `source_id` нет; не строить дедупликацию операций на этом поле.
8. **Теневой режим.** Сравнение не пишет в `elk_plugin_launches`, `gamification_event_logs`, `gamification_transactions` или баланс. Отчёты агрегированные, без email; ошибки идут в Telegram-отчёт Revit.

## 5. Этапы реализации после согласования

1. **Утвердить контракт событий.** С владельцами плагинов проверить исходные сообщения для спорных `trigger`, нулевого результата и нескольких событий одной операции. Зафиксировать полные литералы allowlist, технические имена и дату начала. **Проверка:** примеры успеха, запуска, настроек и отмены каждого выбранного плагина классифицируются однозначно.
2. **Сделать теневой счётчик.** На VPS читать `plugins-usage-analytics` за минский день с полным обходом страниц и проверкой ответа. Считать `email + plugin + day`, сверять с активными `ws_users`, не писать в наградные таблицы. **Проверка:** несколько сухих дат совпадают с Elasticsearch по документам и buckets, число новых игровых событий и транзакций остаётся нулём.
3. **Сравнить несколько рабочих недель.** По каждому имени и дню показывать старое покрытие, подтверждённые действия, совпадения и расхождения; отдельно Civil, пять отсутствующих и задержку доставки. Разобрать 512 предварительно исчезающих пар. **Проверка:** агрегированный отчёт и объяснённые причины расхождений; допустимый порог выбирается после просмотра, не задаётся наугад.
4. **Выбрать модель хранения и метрик.** Разделить или явно переименовать запуски и действия. Перечень затронутых мест: SQL-триггер, Revit-стрик и календарь, рейтинги/достижения, дневная сводка, транзакции, экспорт, аналитика внедрения, административные корректировки. **Проверка:** у каждого счётчика есть однозначная единица, исторические периоды остаются читаемыми.
5. **Переключить выбранные имена с определённой даты.** Для них брать только allowlist нового потока; для остальных сохранить старый. Не складывать оба источника для одного имени. Повторный запуск и догон не должны создавать новую награду или дублировать `details.plugins`. **Проверка:** успех даёт один день и 10 💎 на рабочий день, только открытие не даёт; два плагина не дают две дневные награды; отсутствие и нерабочий день не начисляют.
6. **Проверить пользовательский путь и запуск.** Проверить поздний лог, пропущенный прогон и ошибку Elasticsearch, затем личный Revit-виджет, стрик, рейтинг, транзакцию, админский экспорт и аналитику. Обновить подписи и документацию, наблюдать Telegram-ошибки и расхождения. **Откат:** вернуть старый маршрут для будущих дней; уже проведённые транзакции корректировать отдельно после сверки.

## 6. Открытые решения

- Какие спорные события из раздела 3 действительно подтверждают полезный результат? Требуется смысловое подтверждение от владельца плагина либо проверка исходных логов.
- Что сравнивать в рейтинге и экспорте после перехода: запуски, операции или активные плагин-дни? От этого зависит совместимость старых и новых периодов.
- Какой порог расхождения допустим и с какой даты менять правило? Пока нельзя назвать все 512 исчезающих пар ошибкой: часть запусков могла не сопровождаться полезным действием.
- Считать ли `ClashesManager.Navis`, `ClashesManager.Server`, `SDT.Updater`, `ShareModel.Civil` и старые алиасы отдельными видами использования?

До этих решений безопасный следующий шаг — **только теневое чтение и сравнение**. Этот документ не включает новый источник в ночной пайплайн и не меняет начисления.

## Приложение: полный инвентарь событий в проверенном окне

Это фактически наблюдавшиеся значения `trigger` и число событий за 16.09–15.10.2026. Таблица **не является allowlist**: здесь присутствуют настройки и отмены. Агрегация Elasticsearch по каждому плагину возвращала все значения `trigger` для этого окна.

| `plugin_name` | Точный `trigger` | Событий |
|---|---|---:|
| `ClashesManager.Revit` | `RenderedMessage is "Successfully status items"` | 9934 |
| `ClashesManager.Revit` | `RenderedMessage contains "Clash founded in"` | 6445 |
| `LinksManager` | `RenderedMessage is "Successful completion of revit linker"` | 5324 |
| `LinksManager` | `RenderedMessage is "Successful completion of cad linker"` | 74 |
| `LinksManager` | `RenderedMessage is "Successful completion of ifc linker"` | 54 |
| `LinksManager` | `RenderedMessage is "Successful changed RVT state "Load""` | 3 |
| `LinksManager` | `RenderedMessage is "Successful changed RVT state "Delete""` | 1 |
| `ShareModel` | `RenderedMessage is "ShareModel created"` | 2580 |
| `ShareModel` | `RenderedMessage contains "ShareModel creation time"` | 64 |
| `EnecaFamilies` | `RenderedMessage is "LoadFamily's"` | 1412 |
| `EnecaFamilies` | `RenderedMessage contains "Families successfully loaded"` | 1162 |
| `EnecaFamilies` | `RenderedMessage is "CreatedKit"` | 2 |
| `SDT` | `RenderedMessage contains "Visibility changed for"` | 990 |
| `SDT` | `RenderedMessage is "Change active view"` | 416 |
| `SDT` | `RenderedMessage contains "Solid variant changed for"` | 379 |
| `SDT` | `RenderedMessage contains "Updated schedules"` | 302 |
| `SDT` | `RenderedMessage contains "Switched grids control for"` | 270 |
| `SDT` | `RenderedMessage contains "UpdateSheets"` | 48 |
| `SDT` | `RenderedMessage contains "Applied range positions to"` | 32 |
| `SDT` | `RenderedMessage contains "Count connected elements"` | 14 |
| `SDT` | `RenderedMessage contains "Clean template"` | 5 |
| `SDT` | `RenderedMessage contains "UpdateInserted"` | 4 |
| `ResaveModels` | `RenderedMessage is "Work done"` | 2309 |
| `Auditor` | `RenderedMessage is "Elements audited"` | 593 |
| `Auditor` | `RenderedMessage is "Model audited"` | 536 |
| `Auditor` | `RenderedMessage is "Successfully set parameter in elements"` | 139 |
| `Auditor` | `RenderedMessage is "Open settings"` | 110 |
| `AutoOpenings` | `RenderedMessage is "Merge prototypes process finished successfully"` | 601 |
| `AutoOpenings` | `RenderedMessage is "Create prototypes process finished successfully"` | 318 |
| `AutoOpenings` | `RenderedMessage is "Removing unnecessary prototypes was canceled by the user"` | 2 |
| `AutoOpenings` | `RenderedMessage contains "number of prototypes installed"` | 1 |
| `ParamOperator` | `RenderedMessage is "Parameter injected"` | 209 |
| `ParamOperator` | `RenderedMessage is "Parameter deleted"` | 170 |
| `ParamOperator` | `RenderedMessage is "Parameter formula changed"` | 78 |
| `ParamOperator` | `RenderedMessage is "Settings gathered"` | 41 |
| `ParamOperator` | `RenderedMessage is "Parameter replaced"` | 36 |
| `ParamOperator` | `RenderedMessage is "Parameter value changed"` | 11 |
| `SpacesManager` | `RenderedMessage is "Spaces created finished successfully"` | 220 |
| `SpacesManager` | `RenderedMessage contains "The number of spaces created"` | 219 |
| `SpacesManager` | `RenderedMessage is "Update spaces finished successfully"` | 75 |
| `SharedCoordinates` | `RenderedMessage is "Coordination done"` | 384 |
| `ApartmentLayouts` | `RenderedMessage is "Apartment areas calculated"` | 118 |
| `ApartmentLayouts` | `RenderedMessage is "Chess settings gathered"` | 82 |
| `ApartmentLayouts` | `RenderedMessage is "Core settings gathered"` | 82 |
| `ApartmentLayouts` | `RenderedMessage is "General settings gathered"` | 82 |
| `ApartmentLayouts` | `RenderedMessage is "Chess views created"` | 6 |
| `ApartmentLayouts` | `RenderedMessage is "Request for opening chess view"` | 4 |
| `ApartmentLayouts` | `RenderedMessage is "Manual renumbering finished"` | 2 |
| `FasciaCappings` | `MessageTemplate is "Single fascia creation finished"` | 324 |
| `FasciaCappings` | `MessageTemplate is "Angle adjusted between fascias"` | 7 |
| `QuickMount` | `RenderedMessage is "The placement process fasteners finished successfully"` | 231 |
| `QuickMount` | `RenderedMessage is "The deleting fasteners finished successfully"` | 42 |
| `Finishing` | `RenderedMessage is "RoomCreatorSuccess"` | 207 |
| `Finishing` | `RenderedMessage is "Room finishing creation done"` | 18 |
| `Finishing` | `RenderedMessage is "AdjacencySuccess"` | 5 |
| `Finishing` | `RenderedMessage is "Settings gathered"` | 3 |
| `LookupTables` | `RenderedMessage is "CreatedSizeTable"` | 118 |
| `LookupTables` | `RenderedMessage is "CreatedNewTable"` | 8 |
| `ClashesManager.Navis` | `RenderedMessage is "Create report"` | 58 |
| `ClashesManager.Navis` | `RenderedMessage is "Export to server"` | 58 |
| `FilterAssistant` | `RenderedMessage is "Filter applied"` | 102 |
| `ViewCloner` | `RenderedMessage is "ViewClone process completed"` | 67 |
| `SchedulesTable` | `RenderedMessage is "Settings loaded from file"` | 19 |
| `SchedulesTable` | `RenderedMessage is "Default settings applied"` | 15 |
| `SchedulesTable` | `RenderedMessage is "Start command executed"` | 4 |

Дополнительно за всю историю нового потока, но не за проверенные 30 дней:

| `plugin_name` | Точный `trigger` | Событий за историю |
|---|---|---:|
| `ProfiLay` | `RenderedMessage is "Create hole process finished successfully"` | 179 |
| `ProfiLay` | `RenderedMessage is "Profile layout process finished successfully"` | 171 |
| `ProfiLay` | `RenderedMessage contains "Profile layout completed"` | 168 |
| `LintelsTransfer` | `RenderedMessage is "LintelsTransfer process completed"` | 81 |
| `SurfaceGen` | `RenderedMessage contains "Selected file name xml"` | 36 |
| `SDT.Updater` | `RenderedMessage contains "UpdateSheets"` | 33 |
