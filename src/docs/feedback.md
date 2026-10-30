# feedback

Модуль приёма обратной связи от пользователей: баги, предложения и обжалования списаний 💎.

## Логика работы

Все три типа (`bug`, `suggestion`, `appeal`) хранятся в одной таблице `feedback` и в одной Airtable-таблице `tblchPw2DdhHkD0FD` — различаются по полю `type`. Общий поток: клиент загружает скриншоты в Supabase Storage bucket `feedback-images` → Server Action `submitFeedback` валидирует zod-discriminatedUnion → пишет в Airtable (с typecast) → зеркалирует в Supabase → отправляет уведомление в Teams через `TEAMS_FEEDBACK_WEBHOOK_URL`. Ошибка Airtable или Teams не блокирует сохранение в Supabase.

**Форма (`/feedback`).** На выборе типа три варианта: баг, предложение, обжалование. Для багов/предложений показываются поля header + description (+expected_behavior для багов). Для обжалования — **два колоночных блока**: слева грид дней за последние 60 суток (`AppealDateGrid`), справа список отрицательных операций за те же 60 дней (`AppealTransactionList`). Пользователь может выбрать день, транзакцию или комбинацию. Если транзакция попадает в выбранный день — она подсвечивается диммированно («уже входит в выбранный день»), в сумме учитывается один раз. Данные приходят из двух серверных запросов: `getAppealCalendar(wsUserId)` и `getAppealTransactions(wsUserId)`. Визуал грида выравнен под `StreakPanel` на главной (CELL=18, GAP=3, MONTH_SEP=16). Текстовые поля: описание (мин 5 символов), ссылка на задачу (опциональная), скриншоты.

**Обжалование — расчёт суммы.** `submitFeedback` для `type='appeal'` вызывает `computeAppealSum(wsUserId, dates, transaction_ids)`: сначала сумма всех отрицательных транзакций в выбранных днях (с учётом сдвига `trg_fix_ws_event_date` +1), затем прибавляются транзакции по явным ID — за вычетом тех, что уже посчитаны в днях (дедупликация по id). Также возвращает список `event_date` явных транзакций (используется в Teams-уведомлении). Значение `appeal_total_coins` отрицательное, сохраняется и в Airtable, и в Supabase.

**Админка.** Три страницы:
- `/admin/feedback` — все записи (баги + предложения + обжалования) с фильтром и мультиселектом
- `/admin/appeals` — только обжалования. Клик по строке → `/admin/corrections/<ws_user_id>?from=appeal&appealId=<id>` для перехода в карточку корректировки пользователя с подсветкой обжалования
- `/admin/corrections/<id>` — в составе есть блок `UserAppealsCard` со всеми обжалованиями пользователя, кнопки «Одобрить» / «Отклонить» (через `updateAppealStatus`) и «Заполнить форму» (предзаполняет сценарий `fix_ws_day:green` с датами и описанием из обжалования)

**Статусы обжалования** (`feedback.status`): `new` → `approved` | `rejected`. Меняются только админом через `updateAppealStatus` — одновременно записываются `review_comment`, `reviewed_at`, `reviewed_by`.

**Видимость статуса для пользователя.** На главной странице `StreakPanel` принимает prop `appealsByDate: Map<string, DayAppealInfo>` — тонкая цветная точка в правом верхнем углу ячейки + кастомный тултип со статусом, описанием (первые 20 символов) и комментарием HR. Цвет точки: оранжевый (new) / зелёный (approved) / серый (rejected). Данные собираются на серверной странице `/`: для каждого обжалования берутся `appeal_dates` + `event_date` из транзакций в `appeal_transaction_ids` (один батч-запрос по IN). WS-события со сдвигом +1 (`red_day`, `wrong_status_report`) разворачиваются обратно в «пользовательский» день.

**Teams-уведомления.** Общий webhook `TEAMS_FEEDBACK_WEBHOOK_URL`. Для багов/предложений — старый формат карточки. Для обжалований — расширенный: автор, email, отдел/команда, дни, сумма списания, ФИО руководителя, описание, ссылка на задачу, кнопка «Открыть в админке» (если задан `NEXT_PUBLIC_APP_URL`) + до 4 Action.OpenUrl со скриншотами.

## Зависимости

- Supabase Storage bucket `feedback-images` (публичный) — создаётся вручную
- Airtable база `appKHrxgAJFFZeeQO`, таблица `tblchPw2DdhHkD0FD` с полями `type` (Single Select: bug/suggestion/appeal), `status`, `header`, `description`, `expected_behavior`, `attachments`, `user_*`, `appeal_dates`, `appeal_transaction_ids` (Long text, UUIDы через запятую), `appeal_task_url`, `appeal_total_coins`
- `AIRTABLE_FEEDBACK_TOKEN` в `.env.local`
- `src/config/airtable.ts` — HTTP-клиент Airtable
- `TEAMS_FEEDBACK_WEBHOOK_URL` — Teams Workflow webhook, используется для всех трёх типов
- `src/modules/auth/queries.ts` — `getCurrentUser()`
- Для обжалований: таблицы `ws_daily_statuses`, `gamification_transactions`, функция `fn_minsk_today`

## Типы

- `FeedbackType` = `'bug' | 'suggestion' | 'appeal'`
- `AppealStatus` = `'new' | 'approved' | 'rejected'`
- `FeedbackSchema` — `z.discriminatedUnion('type', [bugOrSuggestionSchema, appealSchema])`
- `FeedbackRecord` — строка Supabase со всеми общими и appeal-полями (nullable для не-appeal)
- `AppealCalendarDay` — элемент грида выбора дат: `{ date, status, absence_type, negative_coins }`

## Actions

- `submitFeedback(input)` — валидация → Airtable → Supabase → Teams. Для `appeal` считает `appeal_total_coins`, собирает `header` автоматически из дат, revalidate `/admin/feedback`, `/admin/appeals`, `/admin/corrections/<wsUserId>`. Возвращает `ActionResult<{ id: string }>`.
- `deleteFeedbackItems(ids)` — удаляет записи любого типа, только для `is_admin`.
- `updateAppealStatus(id, status, comment)` — меняет статус обжалования, пишет `reviewed_at`, `reviewed_by`, `review_comment`. Только для `is_admin` и только для `type='appeal'`.

## Queries

- `getFeedbackList()` — все записи из `feedback` по `created_at DESC`, без фильтра типа. React `cache`.
- `getAppealsList()` — только `type='appeal'`.
- `getUserAppeals(wsUserId)` — обжалования одного пользователя.
- `getAppealCalendar(wsUserId)` — грид последних 90 дней (≈3 месяца): статусы + отрицательные транзакции на день. Используется формой обжалования; `AppealDateGrid` показывает по одному месяцу с навигацией стрелками (по умолчанию — текущий).
- `getAppealTransactions(wsUserId)` — **все** транзакции (положительные, нулевые, отрицательные) за последние **30 дней** (до 100 записей — защитный лимит, редко достигается), обогащённые описанием и иконкой. Используется в правой колонке формы обжалования. Окно короче календарного (60 дней): свежие операции чаще обжалуются. Пользователь может обжаловать и бонус (например, если считает, что сумма должна быть больше), поэтому фильтр по знаку не применяется.

## Ограничения

- Изображения загружаются на клиенте через `uploadFeedbackImages` (Supabase browser client).
- `expected_behavior` заполняется только для `type='bug'`.
- Максимум 5 изображений, не более 10 МБ каждое.
- Поля в Airtable: `user_name/user_department/user_team` — Single Select с `typecast: true`, новые варианты создаются автоматически; `appeal_dates` — Long text (храним как строку через запятую); `appeal_total_coins` — Integer с разрешёнными отрицательными числами.
- `appeal_total_coins` — отрицательное число (сумма списания). Если за выбранные дни нет транзакций `coins < 0`, будет 0 — обжалование всё равно сохраняется.
- Поле `ws_user_id` в `feedback` ссылается на `ws_users.id` и используется для связи обжалования с пользователем на странице корректировок. Для багов/предложений заполняется тем же значением из сессии.
- Для обжалования пользователь выбирает дни только с видимым списанием (`coins < 0` в этот день) или красные дни — проверяется клиентской логикой `isClickable` в `AppealDateGrid`.
- Запись в журнал статуса обжалования идёт только через `updateAppealStatus` server action — минуя RLS (admin client).
