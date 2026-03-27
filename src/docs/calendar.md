# calendar

Управление рабочим календарём: праздники (нерабочие дни) и рабочие переносы (выходные, ставшие рабочими).

## Логика работы

Визуальный календарь в админке (`/admin/calendar`) на 13 месяцев (январь текущего года → январь следующего). Каждый день — кнопка с одним из четырёх состояний. Клик переключает состояние: будний ↔ выходной, выходной (Сб/Вс) ↔ рабочий. Названия записей автоматические ("Выходной" / "Рабочий перенос") — в UI не отображаются.

Четыре состояния дня:
- **workday** — обычный будний (Пн–Пт, нет записи в calendar_holidays)
- **weekend** — обычный выходной (Сб/Вс, нет записи в calendar_workdays)
- **holiday** — ручной выходной (запись в calendar_holidays, клик → DELETE)
- **workday_transfer** — рабочий перенос (запись в calendar_workdays, клик → DELETE)

Множественные клики не блокируют UI — каждый startTransition работает независимо, optimistic updates накапливаются через functional state updates.

## Зависимости

- `calendar_holidays` — праздники/нерабочие дни (id, date UNIQUE, name, created_by, created_at)
- `calendar_workdays` — рабочие переносы (id, date UNIQUE, name, created_by, created_at)
- Модуль `admin` — actions, queries, типы, компонент CalendarClient

## Потребители данных

- **streak-panel** — грид дней на дашборде: holiday → gray, workday_transfer → рабочий день
- **VPS-скрипт compute-gamification** — пропускает праздники при подсчёте стриков, обрабатывает рабочие переносы как рабочие дни
- **PG-функция fn_award_revit_points** — проверяет рабочие пропуски между green-днями с учётом Сб/Вс (но пока без calendar_holidays/calendar_workdays)

## Типы

- `CalendarHolidayRow` — строка из calendar_holidays: id, date, name, created_at
- `CalendarWorkdayRow` — строка из calendar_workdays: id, date, name, created_at
- `AddCalendarDateInput` — Zod: date (YYYY-MM-DD), name (1-100)
- `DeleteCalendarDateInput` — Zod: id (positive int)
- `DayState` — union: workday | weekend | holiday | workday_transfer (только UI)

## Actions

- `addCalendarHoliday({ date, name })` — INSERT calendar_holidays. Проверяет конфликт с calendar_workdays. Revalidate: `/admin/calendar`
- `deleteCalendarHoliday({ id })` — DELETE calendar_holidays. Revalidate: `/admin/calendar`
- `addCalendarWorkday({ date, name })` — INSERT calendar_workdays. Проверяет конфликт с calendar_holidays. Revalidate: `/admin/calendar`
- `deleteCalendarWorkday({ id })` — DELETE calendar_workdays. Revalidate: `/admin/calendar`

## Queries

- `getCalendarHolidays()` — все записи из calendar_holidays, date ASC (admin)
- `getCalendarWorkdays()` — все записи из calendar_workdays, date ASC (admin)
- `getHolidays(gridStart, gridEnd)` — Set дат за период (streak-panel)
- `getWorkdays(gridStart, gridEnd)` — Set дат за период (streak-panel)

## Ограничения

- Дата уникальна в каждой таблице (UNIQUE constraint)
- Одна дата не может быть одновременно в обеих таблицах — actions проверяют конфликт перед INSERT
- RLS: SELECT — все authenticated, INSERT/UPDATE/DELETE — только админы (is_admin в ws_users)
- Названия записей фиксированные — UI не предоставляет поле ввода
