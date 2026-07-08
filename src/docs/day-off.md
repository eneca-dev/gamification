# day-off

Модуль геймификационных выходных. Сотрудник подаёт заявку с скриншотом согласования с руководителем. Одобренный выходной замораживает стрик и окрашивает день синим в гриде.

## Логика работы

Сотрудник заполняет форму: дата (сегодня до 16:30 по Минску или любая будущая), необязательный комментарий, обязательный скриншот переписки с руководителем (для `day_off`). Скриншот загружается в Storage-бакет `day-off-screenshots`.

После подачи заявка попадает в статус `pending`. Администратор может вручную одобрить или отклонить. Если не действует — заявка обрабатывается автоматически pg_cron-функцией `fn_process_day_off_requests()` каждые 2 минуты (только в рабочее время Пн–Пт 9:00–18:00 Минск).

После одобрения в `ws_user_absences` вставляется запись с `absence_type = 'day_off'`. VPS-скрипт `compute-gamification` при обработке этой даты помечает день как `absent`. В результате стрик замораживается (дельта = 0), грид показывает синий квадрат.

## Зависимости

- `ws_user_absences` — запись при одобрении (absence_type = 'day_off')
- `ws_daily_statuses` — заполняется VPS после вставки в ws_user_absences
- `day_off_requests` — основная таблица модуля
- `_day_off_schedule` — служебная таблица: `request_id`, `ts_b` (когда авто-одобрить). Без грантов для authenticated
- Storage bucket `day-off-screenshots` — скриншоты переписки
- pg_cron `fn_process_day_off_requests()` — автоматическая обработка

## Статусы

- `pending` — подана, ожидает рассмотрения
- `approved` — одобрена, ws_user_absences обновлена
- `rejected` — отклонена, ws_user_absences не меняется

## Actions

- `submitDayOffRequest(input)` — подача заявки, revalidatePath('/day-off')
- `uploadDayOffScreenshot(formData)` — загрузка файла в Storage, возвращает path
- `approveDayOffRequest(id)` — одобрение (только admin). Атомарный UPDATE с `.eq('status', 'pending')` — защита от race condition. Вставляет в ws_user_absences. revalidatePath оба маршрута
- `rejectDayOffRequest(input)` — отклонение (только admin). Только `pending` заявки. revalidatePath оба маршрута

## Queries

- `getUserDayOffRequests(wsUserId)` — все заявки пользователя, desc по created_at
- `getActiveDayOffRequest(wsUserId)` — активная заявка (pending) или null
- `getAllDayOffRequestsAdmin()` — все заявки для админ-панели, включает approved_by_name и rejected_by_name
- `getScreenshotSignedUrl(path)` — signed URL на 1 час для просмотра скриншота

## Ограничения

- Дата заявки — сегодня (только до 16:30 по Минску, иначе HR не успеет рассмотреть) или любая будущая дата. Проверка в `getDayOffDateError()` (utils.ts), используется и на клиенте (DatePicker minDate + уведомление), и на сервере (actions.ts)
- Нельзя иметь две активные (pending) заявки на одну дату — partial UNIQUE INDEX
- `_day_off_schedule.ts_b` никогда не возвращается клиенту — column-level гранты
- Авто-обработка работает только в Пн–Пт 9:00–18:00 МСК
- `approved_by_id/name` и `rejected_by_id/name` — только service_role, не видны authenticated
- Отклонить можно только `pending`-заявку. Одобренные (`approved`) через UI не отклоняются
