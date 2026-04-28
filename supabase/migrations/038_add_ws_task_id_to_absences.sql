-- Связь absence-записи с подзадачей сикдея в Worksection.
-- Заполняется только для absence_type='sick_day' (родитель — task 4905680).
-- Для vacation/sick_leave (источник: get_users_schedule) остаётся NULL.

ALTER TABLE public.ws_user_absences
  ADD COLUMN ws_task_id text;

-- Частичный индекс для быстрого DELETE/UPDATE по ws_task_id при синхронизации сикдеев.
CREATE INDEX IF NOT EXISTS idx_ws_user_absences_ws_task_id
  ON public.ws_user_absences (ws_task_id)
  WHERE ws_task_id IS NOT NULL;
