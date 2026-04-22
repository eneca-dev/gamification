# gratitudes

Благодарности между сотрудниками. Отправляются из приложения, 💎 начисляются автоматически триггером в БД.

## Логика работы

Пользователь отправляет благодарность через модалку на dashboard. Server action `sendGratitude` вставляет запись в таблицу `gratitudes`. Триггер `trg_award_gratitude_points_v2` начисляет получателю 💎 (`gratitude_recipient_points`, 20 ПК по умолчанию).

Квота: 1 начисление 💎 в неделю на отправителя. Благодарности без лимита — можно отправлять сколько угодно, но 💎 получатель получит только за первую от этого отправителя на текущей неделе (пн-вс).

Нельзя отправить благодарность самому себе (CHECK constraint + серверная валидация).

## Зависимости

- Таблица `gratitudes` — sender_id/recipient_id FK на ws_users
- `gamification_event_logs` — запись о начислении (event_type = `gratitude_recipient_points`, source = `gratitudes`)
- `gamification_transactions` — 💎
- `gamification_balances` — баланс (обновляется триггером)
- `gamification_event_types` — конфигурация 💎 (key = `gratitude_recipient_points`)
- RPC: `get_user_gratitudes`, `get_gratitudes_feed`, `get_sender_quota`

## Типы

- `Gratitude` — полная благодарность с именами sender/recipient, department, earned_coins
- `SenderQuota` — { used: boolean, coins_per_gratitude: number }
- `GratitudeRecipient` — { id, name, department } для списка выбора
- `SendGratitudeInput` — Zod-схема: recipient_id (uuid), message (0-500, опционально), category (nullable)

## Queries

- `getUserGratitudes(recipientEmail, limit?)` — благодарности полученные пользователем, с earned_coins
- `getGratitudesFeed(limit?)` — все благодарности (для activity page)
- `getSenderQuota(senderId)` — статус квоты отправителя на текущей неделе
- `getGratitudeRecipients(excludeUserId)` — список активных ws_users для выбора

## Actions

- `sendGratitude({ recipient_id, message, category })` — отправка. Валидация Zod, проверка sender != recipient, INSERT в gratitudes, revalidatePath('/')

## Компоненты

- `GratitudeWidget` — виджет на дашборде. Шапка с кнопкой «Поблагодарить», до 3 благодарностей, ссылка «Все благодарности →». Приоритет отображения: полученные → отправленные → пустое состояние. Подзаголовок меняется динамически: «Последние полученные» / «Последние отправленные»
- `SendGratitudeButton` — standalone-кнопка «Поблагодарить» + модалка. Поиск получателя, ввод сообщения, категория, отображение квоты
- `SendGratitudeModal` — модалка отправки, открывается из GratitudeWidget и SendGratitudeButton
- `GratitudeCard` — карточка благодарности (иконка направления, категория, имя, сообщение, время, 💎)

## Поле category

Подготовлено для будущего достижения `ach_culture_mentor` (наставничество). Пока не используется в UI — передаётся null.

## Устаревшая система (НЕ УДАЛЕНА)

Таблица `at_gratitudes`, VIEW `v_gratitudes_feed`, функция `fn_award_gratitude_points`, edge function `sync-gratitudes` — отключены, будут удалены позже.

## Ограничения

- earned_coins = 0 не значит "благодарность не учтена" — отправитель уже использовал квоту
- 💎 = 20 ПК, значение берётся из `gamification_event_types`, не хардкодится
- Получатель должен быть active в ws_users
