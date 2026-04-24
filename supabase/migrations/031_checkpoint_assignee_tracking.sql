-- Отслеживание ассайни в момент фиксации чекпоинта.
-- При смене ответственного за задачу (переназначение) скрипт compute-gamification
-- тихо сбрасывает чекпоинт, чтобы не наказывать нового исполнителя за накопленную
-- историю предыдущего.

ALTER TABLE ws_task_budget_checkpoints
  ADD COLUMN IF NOT EXISTS assignee_id_at_checkpoint uuid NULL;

-- Бэкфилл: существующие строки получают текущего ассайни задачи.
-- Это критично, иначе при первом прогоне после миграции ВСЕ задачи получили бы
-- «тихий сброс» (null != new uuid).
UPDATE ws_task_budget_checkpoints bc
SET assignee_id_at_checkpoint = t.assignee_id
FROM ws_tasks_l3 t
WHERE bc.ws_task_id = t.ws_task_id
  AND bc.assignee_id_at_checkpoint IS NULL;
