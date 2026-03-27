# Управление календарём (выходные и праздники)

## Цель

Раздел «Календарь» в админке — визуальный календарь для управления рабочими/нерабочими днями. Клик по дню переключает его состояние. Данные учитываются в стриках и гриде дней.

## Существующая инфраструктура

### Таблицы БД (миграции 015–016)

```
calendar_holidays:  id, date (UNIQUE), name, created_by (FK auth.users), created_at
calendar_workdays:  id, date (UNIQUE), name, created_by (FK auth.users), created_at
```

RLS: SELECT — authenticated, INSERT/UPDATE/DELETE — только админы (is_admin в ws_users).

### Потребители данных

- **streak-panel** — `getHolidays()` / `getWorkdays()`: грид дней на дашборде (праздник → gray, перенос → рабочий)
- **VPS-скрипт compute-gamification** — пропускает праздники, обрабатывает рабочие переносы при подсчёте стриков

## Реализация

### Backend

**Типы** (`src/modules/admin/types.ts`):
- `CalendarHolidayRow`, `CalendarWorkdayRow` — строки таблиц: id, date, name, created_at
- `AddCalendarDateInput` — Zod: date (YYYY-MM-DD), name (1-100)
- `DeleteCalendarDateInput` — Zod: id (positive int)

**Queries** (`src/modules/admin/queries.ts`):
- `getCalendarHolidays()` — все записи, сортировка по date ASC
- `getCalendarWorkdays()` — все записи, сортировка по date ASC

**Actions** (`src/modules/admin/actions.ts`):
- `addCalendarHoliday({ date, name })` — INSERT. Проверяет конфликт с calendar_workdays. Revalidate: `/admin/calendar`
- `deleteCalendarHoliday({ id })` — DELETE. Revalidate: `/admin/calendar`
- `addCalendarWorkday({ date, name })` — INSERT. Проверяет конфликт с calendar_holidays. Revalidate: `/admin/calendar`
- `deleteCalendarWorkday({ id })` — DELETE. Revalidate: `/admin/calendar`

### UI

**Страница** (`src/app/(main)/admin/calendar/page.tsx`):
- Server Component, загружает holidays + workdays через `Promise.all`

**CalendarClient** (`src/modules/admin/components/CalendarClient.tsx`):
- Визуальный календарь: сетка из 13 месяцев (январь текущего года → январь следующего)
- Каждый месяц — `MonthCard` с 7-колоночной сеткой дней

**Четыре состояния дня (`DayState`):**

| Состояние | Визуал | Клик → действие |
|---|---|---|
| `workday` (будний) | Белый фон, тёмный текст | → INSERT calendar_holidays ("Выходной") |
| `weekend` (Сб/Вс) | Серый фон, бледный текст | → INSERT calendar_workdays ("Рабочий перенос") |
| `holiday` (ручной выходной) | Красный фон, белый текст | → DELETE из calendar_holidays |
| `workday_transfer` (рабочий перенос) | Зелёный фон, белый текст | → DELETE из calendar_workdays |

**Optimistic updates:**
- Клик мгновенно меняет state (setHolidays/setWorkdays с functional update)
- Серверный запрос в startTransition — не блокирует UI
- Множественные клики работают параллельно (нет disabled/isPending)
- При ошибке — откат к предыдущему state, показ ошибки

**Другие элементы:**
- Легенда цветов над календарём
- Подсветка текущего дня (inset box-shadow с --apex-primary)
- Toast-уведомления через createPortal
- Скелетон загрузки повторяет сетку месяцев

**AdminNav** — добавлен таб «Календарь» (иконка CalendarDays)

## Ограничения

- Названия записей автоматические ("Выходной" / "Рабочий перенос") — не редактируются в UI
- Дата уникальна в каждой таблице — дубли блокируются UNIQUE constraint
- Одна дата не может быть одновременно в обеих таблицах — actions проверяют конфликт
- Revalidate только `/admin/calendar` — streak-panel читает данные на сервере при каждом запросе

## Критерии готовности

- [x] Визуальный календарь на 13 месяцев
- [x] Клик по будню → выходной (calendar_holidays)
- [x] Клик по выходному → рабочий (calendar_workdays)
- [x] Клик по переключённому дню → откат (DELETE)
- [x] Optimistic updates без блокировки
- [x] Конфликт между таблицами валидируется
- [x] Грид стриков учитывает изменения
- [x] npm run build проходит без ошибок
