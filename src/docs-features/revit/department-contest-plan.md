# План: Соревнование отделов — метрика по 💎 + начисление бонуса

## Контекст

Соревнование отделов по автоматизации (Revit). Сейчас метрика — "% сотрудников использующих плагины". Нужно: сумма 💎 за ревит по отделу. Плюс автоматическое начисление бонуса 1 числа каждого месяца.

## Что делаем

### Шаг 1. VIEW `view_department_revit_contest` в БД

Считает сумму ревит-💎 по отделам за текущий месяц. Один SELECT вместо двух запросов + JS-агрегации.

### Шаг 2. Переписать `getDepartmentAutomationStats()`

Один SELECT из VIEW вместо 2 запросов + агрегации в JS.

### Шаг 3. Обновить тип `DepartmentAutomationEntry`

Добавить `totalCoins`, убрать `usagePercent`.

### Шаг 4. Обновить компонент `DepartmentContest`

Колонка автоматизации: отображать монеты вместо процентов.

### Шаг 5. Функция `fn_award_department_contest()` в БД

Считает победителя за прошлый месяц, начисляет 200 монет каждому активному сотруднику отдела-победителя.

### Шаг 6. pg_cron задача на 1 число месяца

`SELECT fn_award_department_contest()` — 1 числа в 02:00 UTC.

## Затрагиваемые файлы

| Файл/место                                       | Изменение                                       |
| ------------------------------------------------ | ----------------------------------------------- |
| БД: VIEW                                         | `view_department_revit_contest`                 |
| БД: функция                                      | `fn_award_department_contest()`                 |
| БД: pg_cron                                      | Задача на 1 число                               |
| `src/modules/revit/queries.ts`                   | Переписать `getDepartmentAutomationStats()`     |
| `src/modules/revit/types.ts`                     | Обновить `DepartmentAutomationEntry`            |
| `src/components/dashboard/DepartmentContest.tsx` | Монеты вместо процентов в колонке автоматизации |
| `src/lib/data.ts`                                | Обновить `DepartmentEntry`                      |
| `src/app/(main)/page.tsx`                        | Обновить маппинг                                |
| `src/docs/gamification-events.md`                | Обновить секцию 5                               |
