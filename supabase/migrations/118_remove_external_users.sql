-- Удаление 10 внешних пользователей из ws_users.
-- Это внешние контрагенты (НЭП, Пробилдпроект, Технологии климата, Подрядчик, "Прочее"),
-- которые числятся в Worksection, но не ведут задач, не сдают отчётов и не входят в приложение.
-- Весь их след в БД — автогенерация системы геймификации (red_day статусы и транзакции).
--
-- Параллельно в sync-ws-users.ts добавлен SKIP_EMAILS,
-- чтобы следующий прогон синхронизации не воссоздавал их заново.

BEGIN;

CREATE TEMP TABLE _targets ON COMMIT DROP AS
SELECT id FROM public.ws_users
WHERE lower(email) IN (
  'i.savchenko@novoexpoprom.by',
  'i.sosinovskiy@novoexpoprom.by',
  'o.romuz@novoexpoprom.by',
  'zoya@belafrica.co',
  'denis.kolesnikov@belafrica.co',
  'dmitriy.l@probuildproject.com',
  'mokhart@stclimat.by',
  'mn@bygcom.com',
  'mihailkutser@gmail.com',
  'info@sprytna.by'
);

-- FK NO ACTION — чистим руками до DELETE из ws_users
DELETE FROM public.gamification_event_logs    WHERE user_id IN (SELECT id FROM _targets);
DELETE FROM public.gamification_transactions  WHERE user_id IN (SELECT id FROM _targets);
DELETE FROM public.gamification_balances      WHERE user_id IN (SELECT id FROM _targets);

-- ws_daily_statuses, revit_user_streaks, day_off_requests — CASCADE
DELETE FROM public.ws_users WHERE id IN (SELECT id FROM _targets);

COMMIT;
