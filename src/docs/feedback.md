# feedback

Модуль приёма обратной связи от пользователей: баг-репорты и предложения.

## Логика работы

Пользователь открывает модал через плавающую кнопку (видна на всех страницах). Выбирает тип (bug / suggestion), заполняет форму, опционально прикрепляет несколько скриншотов. При отправке: клиент загружает изображения в Supabase Storage bucket `feedback-images` и получает публичные URL. Затем вызывается Server Action `submitFeedback`, который создаёт запись в Airtable (с вложениями) и зеркалирует в Supabase таблицу `feedback`. Данные пользователя (имя, email, отдел, команда) берутся из сессии автоматически. Ошибка Airtable не блокирует сохранение в Supabase.

Администраторы видят все записи на странице `/admin/feedback`. Данные читаются из Supabase через `createSupabaseAdminClient` (обходит RLS). Страница поддерживает мультиселект и удаление строк. Картинки отображаются превьюшками с лайтбоксом. Имя автора — ссылка на `/admin/users/[user_id]`.

## Зависимости

- Supabase Storage bucket `feedback-images` (публичный) — создаётся вручную
- Airtable база `appKHrxgAJFFZeeQO`, таблица `tblchPw2DdhHkD0FD`
- `AIRTABLE_FEEDBACK_TOKEN` в `.env.local`
- `src/config/airtable.ts` — HTTP-клиент Airtable
- `src/modules/auth/queries.ts` — `getCurrentUser()`

## Типы

`FeedbackType` = `'bug' | 'suggestion'`  
`FeedbackInput` — валидируется через `FeedbackSchema` (Zod)  
`FeedbackRecord` — строка таблицы `feedback` из Supabase; включает `user_id`, `user_name`, `user_email`, `user_department`, `user_team`

## Actions

- `submitFeedback(input)` — создаёт запись в Airtable + зеркало в Supabase, revalidate `/admin/feedback`. Возвращает `ActionResult<{ id: string }>`.
- `deleteFeedbackItems(ids)` — удаляет записи по массиву id, только для `is_admin`, revalidate `/admin/feedback`.

## Queries

- `getFeedbackList()` — все записи из `feedback` по `created_at DESC`, без кэш-тега (Server Component с React `cache`).

## Ограничения

- Изображения загружаются на клиенте через `uploadFeedbackImages` (Supabase browser client), не через Server Action.
- `expected_behavior` заполняется только для `type = 'bug'`.
- Максимум 5 изображений, не более 10 МБ каждое.
- Поля `user_name/user_department/user_team` в Airtable — Single Select с `typecast: true`, новые варианты создаются автоматически.
- `user_email` хранится только в Supabase, в Airtable не передаётся.
- `user_name` берётся из `user.fullName` → `raw_user_meta_data.full_name` в auth.users. Если поле пустое, имя в записи будет пустой строкой.
