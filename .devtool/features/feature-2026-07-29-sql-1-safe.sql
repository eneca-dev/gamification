-- ЭТАП 1 — безопасные объекты, можно применять хоть сейчас.
-- Ничего в текущем поведении приложения не меняют: новые функции/view/колонка
-- никто не вызывает и не читает, пока не наступит ЭТАП 2 (см. feature-2026-07-29-sql-2-activation.sql).

-- Параметры (финализировать перед применением):
--   дней в топе — 20 (было 10)
--   топ по запускам — 10

-- 1. Ранжирование по реальным запускам плагинов, параметризовано по дате явно
--    (специально НЕ через fn_minsk_today() внутри функции — это баг, найденный
--    в существующих view_top_pers_revit/view_top_pers_ws: они читают "живую" дату
--    в момент REFRESH, а не ту дату, которую им передаёт вызывающая функция.
--    На границе месяца это стирает весь накопленный месяц из агрегации).
CREATE OR REPLACE FUNCTION public.fn_revit_launches_rank(p_asof date)
RETURNS TABLE(user_id uuid, launches int, rnk int)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH cum AS (
    SELECT wu.id AS user_id, SUM(l.launch_count)::int AS launches
    FROM elk_plugin_launches l
    JOIN ws_users wu ON wu.email = lower(l.user_email) AND wu.is_active = true
    WHERE l.work_date >= date_trunc('month', p_asof)::date
      AND l.work_date <= p_asof
    GROUP BY wu.id
  )
  SELECT user_id, launches, rank() OVER (ORDER BY launches DESC)::int AS rnk
  FROM cum
  WHERE launches > 0
$function$;

-- 2. Постоянная вью для ручных проверок/будущего таблично-админского вида —
--    отдельно от снапшот-логики, "живая" на текущий момент (fn_minsk_today() тут
--    уместен — это просто окно для просмотра, не автоматика).
CREATE OR REPLACE VIEW public.view_top_pers_revit_launches AS
SELECT
  r.rnk AS rank,
  r.user_id,
  wu.first_name,
  wu.last_name,
  wu.department_code,
  r.launches
FROM fn_revit_launches_rank(fn_minsk_today()) r
JOIN ws_users wu ON wu.id = r.user_id
ORDER BY r.rnk;

-- 3. Новая колонка в настройках — NULL = старое поведение, ничего не активирует.
ALTER TABLE public.ach_ranking_settings
  ADD COLUMN IF NOT EXISTS secondary_rank_limit int NULL;
