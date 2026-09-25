-- Add previous-period comparison for the Worksection discipline cards.
-- The existing v2 function remains unchanged for compatibility.
CREATE OR REPLACE FUNCTION public.get_adoption_period_worksection_v3(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_result jsonb;
  v_previous_from date;
  v_previous_to date;
  v_green_previous numeric;
  v_wrong_task_previous numeric;
  v_no_report_previous numeric;
BEGIN
  IF p_to IS NULL OR (p_from IS NOT NULL AND p_from > p_to) THEN
    RAISE EXCEPTION 'Invalid adoption period';
  END IF;

  v_result := public.get_adoption_period_worksection_v2(p_from, p_to);

  IF p_from IS NULL THEN
    RETURN v_result || jsonb_build_object(
      'previous_from', NULL,
      'previous_to', NULL,
      'green_previous', NULL,
      'wrong_task_previous', NULL,
      'no_report_previous', NULL
    );
  END IF;

  v_previous_to := p_from - 1;
  v_previous_from := p_from - ((p_to - p_from) + 1);

  WITH
  cohort AS MATERIALIZED (
    SELECT c.id
    FROM public.adoption_designer_cohort_v2() c
  ),
  previous_statuses AS MATERIALIZED (
    SELECT s.status, s.red_reasons
    FROM public.ws_daily_statuses_baseline s
    JOIN cohort c ON c.id = s.user_id
    WHERE s.date BETWEEN v_previous_from AND v_previous_to

    UNION ALL

    SELECT s.status, s.red_reasons
    FROM public.ws_daily_statuses s
    JOIN cohort c ON c.id = s.user_id
    WHERE s.date BETWEEN v_previous_from AND v_previous_to
  ),
  totals AS (
    SELECT
      count(*) FILTER (WHERE status IN ('green', 'red'))::numeric AS tracked,
      count(*) FILTER (WHERE status = 'green')::numeric AS green,
      count(*) FILTER (
        WHERE status = 'red'
          AND red_reasons @> '[{"type":"wrong_status_report"}]'
      )::numeric AS wrong_task,
      count(*) FILTER (
        WHERE status = 'red'
          AND red_reasons @> '[{"type":"red_day"}]'
      )::numeric AS no_report
    FROM previous_statuses
  )
  SELECT
    COALESCE(round(100.0 * green / NULLIF(tracked, 0)), 0),
    COALESCE(round(1000.0 * wrong_task / NULLIF(tracked, 0)) / 10, 0),
    COALESCE(round(1000.0 * no_report / NULLIF(tracked, 0)) / 10, 0)
  INTO v_green_previous, v_wrong_task_previous, v_no_report_previous
  FROM totals;

  RETURN v_result || jsonb_build_object(
    'previous_from', v_previous_from,
    'previous_to', v_previous_to,
    'green_previous', v_green_previous,
    'wrong_task_previous', v_wrong_task_previous,
    'no_report_previous', v_no_report_previous
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_adoption_period_worksection_v3(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_adoption_period_worksection_v3(date, date) TO service_role;
