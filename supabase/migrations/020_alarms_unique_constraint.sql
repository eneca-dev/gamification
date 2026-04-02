-- Защита от дублей алармов при параллельном запуске скрипта.
-- Один аларм на (пользователь, тип, задача, дата).
-- ws_task_id может быть NULL (для team-алармов без конкретной задачи),
-- поэтому используем COALESCE.

CREATE UNIQUE INDEX IF NOT EXISTS idx_alarms_unique_per_day
  ON alarms (user_id, alarm_type, COALESCE(ws_task_id, ''), alarm_date)
  WHERE is_resolved = false;
