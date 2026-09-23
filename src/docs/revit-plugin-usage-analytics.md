# Plugins Usage Analytics для геймификации

`plugins-usage-analytics` — Elasticsearch data stream с событиями **действий внутри** Revit-плагинов: сотрудник (`email`), время, плагин (`plugin_name`) и техническое действие (`trigger`).

Текущий `sync-plugin-launches` видит только запуск приложения. Поэтому открытие и закрытие плагина сейчас выглядит как использование. Новый источник применять только через строгий allowlist — учитывать лишь событие, которое подтверждает завершённое полезное действие.

```text
события за день → оставить allowlist → сгруппировать по сотруднику и дню
                → одна дневная награда / без повторного начисления
```

В транзакции показывать понятный текст («Links Manager: модель связана»), а не сырой `trigger`.

## Строгий allowlist

В таблице перечислены события, которые можно засчитывать. Все неуказанные события не засчитываются. Повторы одной операции и несколько операций за один день не дают повторной дневной награды.

| Плагин | Засчитывать `trigger` |
|---|---|
| ClashesManager.Revit | `Clash founded in`, `Successfully status items` |
| ParamOperator | `Parameter replaced/injected/value changed/deleted/formula changed`, `Success`, `Data imported` |
| LinksManager | `Successful completion of revit/cad/ifc linker`, `Successful changed RVT state "Load"/"Delete"` |
| SDT | `Solid variant changed`, `Visibility changed`, `Updated schedules`, `Switched grids control`, `Applied range positions`, `UpdateSheets`, `Count connected elements`, `Center of gravity was founded`, `Clean template`, `UpdateInserted`, `UpdateHolesAndOpenings`, `UpdateSuperElements` |
| ShareModel | `ShareModel created`, `ShareModel creation time` |
| EnecaFamilies | `Families successfully loaded` *(не `LoadFamily's` — это только старт)* |
| Auditor | `Elements audited`, `Model audited`, `Successfully set parameter in elements` |
| ResaveModels | `Work done`, `Share/Central/Release success total` |
| FasciaCappings | `Fascia created`, `Single fascia creation finished`, `Angle adjusted` |
| SpacesManager | `The number of spaces created`, `Spaces created finished successfully`, `Update spaces finished successfully` |
| Finishing | `FloorCreatorSuccess`, `RoomCreatorSuccess`, `AdjacencySuccess`, события `... creation done`, `Finishing created...`, `connected with host wall` |
| ApartmentLayouts | `Success`, `Apartment areas calculated`, `Chess views created`, `Auto/Manual renumbering finished`, `Edit apartment number used` |
| AutoOpenings | `number of prototypes installed`, `Create/Merge prototypes process finished successfully` |
| SharedCoordinates | `Coordination done`, `Files coordinated` |
| LookupTables | `CreatedSizeTable`, `CreatedNewTable` |
| ViewCloner | `ViewClone process completed` |
| FilterAssistant | `Filter applied` |
| QuickMount | `number of fasteners installed`, `The placement/deleting fasteners finished successfully`, `Number of removed fasteners` |
| ClashesManager.Navis | `Create report`, `Export to server` |
| ProfiLay | `Create hole process finished successfully`, `Profile layout process finished successfully`, `Profile layout completed` |
| LintelsTransfer | `LintelsTransfer process completed` |
| SDT.Updater | `UpdateSheets` |

**Не засчитывать:** `SDT: Change active view`; открытия и сбор настроек; выбор пути/файла; отменённые действия; у EnecaFamilies — `LoadFamily's`; у SchedulesTable — все три имеющихся события (запуск и настройки); у SurfaceGen — единственное событие выбора XML-файла. Для SchedulesTable и SurfaceGen поток пока не содержит подтверждения результата.

## Чего не хватает

Из 27 плагинов текущей конфигурации геймификации в новом data stream **нет**: `SetToRevit`, `ParkingSlots`, `HVACAutoTag`, `Evacuation`, `RevitDataExporter`.

В старом источнике также есть Civil-плагины, которых в новом потоке нет: `IFCExchangeMaster.Civil`, `StrucAndPipe.Civil`, `ModelPoint.Civil`, `ShareModel.Civil`, `CurbGenerator.Civil`, `GroundAnalyzer.Civil`. Их на новый источник перевести сейчас нельзя.

## Проверка за 31 августа

Старый синк увидел 154 сотрудников; строгий новый поток — 117. Совпали 115. В старом есть, а в новом строгом списке нет 39 человек.

| Причина | Сотрудники |
|---|---|
| В новом потоке нет ни одного события | Алексей Брысин, Алексей Холодов, Алина Урицкая, Анастасия Молодянова, Анна Панько, Антон Козак, Антон Петрукович, Арсений Аржанухин, Артём Липский, Артём Садовничий, Вадим Петровский, Вадим Шаповалов, Виктория Боброва, Владимир Николюк, Владислав Бессонов, Владислав Богдан, Владислав Остапчик, Евгений Кравцов, Елизавета Цырук, Игорь Дударёнок, Ирина Фигурина, Кирилл Макаренко, Максим Лосик, Мария Шут, Никита Данилов, Николай Шевелёв, Нина Седлецкая, Павел Иванов, Павел Станкуть, Сергей Клопов, Сергей Оганесян, Сергей Шлеменков |
| Нет события; старый синк видел Civil-плагин, которого новый поток не поддерживает | Антон Войткевич, Елена Георгиева, Зинаида Исакова, Кирилл Цвирко, Мария Савченко |
| Есть только `LoadFamily's`, нет успешного окончания загрузки | Дмитрий Баркун, Егор Прищепов |

## Почему их нет — простыми словами

Старый источник записывает **факт запуска** плагина, а новый — только операции, которые его сборщик умеет отправлять. Поэтому разница не означает, что 37 сотрудников не работали: у них либо плагин/действие не поддерживается новым сборщиком, либо запись не дошла до него. У Дмитрия Баркуна и Егора Прищепова начало операции дошло, а её успешное завершение — нет.

Переключать начисления на новый источник для всех пока нельзя. Сначала проверить сборщик и покрытие отсутствующих плагинов, особенно Civil, и провести параллельную сверку за несколько рабочих недель.
