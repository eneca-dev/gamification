-- Очистка ошибочных штрафов wrong_status_report для задач с меткой «Курирование»
-- Задачи «Курирование» освобождены от требования статуса «В работе»
--
-- Исторически wrong_status_report НЕ влиял на статус дня (red/green) и стрики,
-- поэтому очищаем только events (-3 монеты) и транзакции, возвращая баланс.

BEGIN;

-- 1. Возврат монет: coins у wrong_status_report = -3, поэтому вычитаем (отменяем штраф)
UPDATE gamification_balances b
SET total_coins = b.total_coins - sub.total_coins,
    updated_at = now()
FROM (
  SELECT t.user_id, SUM(t.coins) AS total_coins
  FROM gamification_transactions t
  JOIN gamification_event_logs e ON e.id = t.event_id
  WHERE e.event_type = 'wrong_status_report'
    AND e.details->>'ws_task_name' LIKE '{Курирование%'
  GROUP BY t.user_id
) sub
WHERE b.user_id = sub.user_id;

-- 2. Удалить транзакции
DELETE FROM gamification_transactions t
USING gamification_event_logs e
WHERE t.event_id = e.id
  AND e.event_type = 'wrong_status_report'
  AND e.details->>'ws_task_name' LIKE '{Курирование%';

-- 3. Удалить events
DELETE FROM gamification_event_logs
WHERE event_type = 'wrong_status_report'
  AND details->>'ws_task_name' LIKE '{Курирование%';

COMMIT;
