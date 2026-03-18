# gratitudes

Благодарности, полученные текущим пользователем. Данные из Airtable, отображаются на главной.

## Логика работы

Данные синхронизируются из Airtable через Edge Function в таблицу `at_gratitudes`.
View `v_gratitudes_feed` добавляет имя отправителя (из `ws_users`) и `earned_coins` (из `gamification_transactions`).

Коины начисляются только за первую благодарность от отправителя за неделю. Логика определения — на стороне Edge Function, которая создаёт запись в `gamification_event_logs` с `event_type = 'gratitude_recipient_points'` и `details.gratitude_id`. View просто проверяет наличие связанной транзакции.

## Зависимости

- `at_gratitudes` — сырые данные из Airtable
- `ws_users` — имя отправителя по email
- `gamification_event_logs` — определение earned_coins через `details.gratitude_id`
- `gamification_transactions` — реальная сумма коинов
- View `v_gratitudes_feed` — агрегирует всё выше
- `createSupabaseAdminClient` — ws_users и event_logs закрыты RLS (service_role only)

## Типы

- `GratitudeFeedItem` — id, sender_name, recipient_name, message, earned_coins (0 если без коинов)

## Queries

- `getUserGratitudes(recipientEmail, limit?)` — благодарности полученные конкретным пользователем, с earned_coins

## Ограничения

- Данные только для чтения (запись через Airtable форму)
- earned_coins = 0 не значит "благодарность не учтена" — просто отправитель уже отправлял кому-то на этой неделе
- Реальная сумма коинов = 20 (определяется event_coin_config в БД, не хардкодится на фронте)
