-- Ускорение «Основных показателей» дашборда внедрения.
-- На боевых данных функция занимала ~3.8 с при statement_timeout = 8 с у роли
-- PostgREST и падала по таймауту, когда четыре RPC страницы конкурировали за CPU.
--
-- Что изменено (результат функции не меняется):
--  1. work_mem поднят на время выполнения: при 2 МБ сортировки ws_grid и
--     revit_chart уходили на диск (external merge).
--  2. ws_grid потерял GROUP BY: (user_id, date) уникальна в ws_daily_statuses
--     (PK) и в ws_daily_statuses_baseline (unique key), диапазоны таблиц не
--     пересекаются (baseline <= 2026-06-30, рабочая >= 2026-07-01), поэтому
--     LEFT JOIN даёт максимум одну строку и агрегат был лишним.
--  3. status_source и plugin_source ограничены диапазоном периода.
--  4. plugin_source дедуплицирован на входе, поэтому revit_chart считает
--     count(email) вместо count(DISTINCT email) — исчезает отдельная сортировка.
--  5. Шесть коррелированных подзапросов overview_days заменены двумя LEFT JOIN
--     по сведённым за день таблицам улучшений.

CREATE OR REPLACE FUNCTION public.get_adoption_period_core_v2(p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
 SET work_mem TO '32MB'
AS $function$
DECLARE v_result jsonb;
BEGIN
  IF p_to IS NULL OR (p_from IS NOT NULL AND p_from > p_to) THEN RAISE EXCEPTION 'Invalid adoption period'; END IF;
  WITH
  bounds AS MATERIALIZED (
    SELECT CASE WHEN p_from IS NULL THEN NULL ELSE p_from::timestamp AT TIME ZONE 'Europe/Minsk' END AS from_ts,
      (p_to+1)::timestamp AT TIME ZONE 'Europe/Minsk' AS to_ts,
      COALESCE(p_from,(SELECT LEAST(
        COALESCE((SELECT min((created_at AT TIME ZONE 'Europe/Minsk')::date) FROM public.profiles),p_to),
        COALESCE((SELECT min(date) FROM public.ws_daily_statuses_baseline),p_to),
        COALESCE((SELECT min(work_date) FROM public.elk_plugin_launches_baseline),p_to)
      ))) AS effective_from
  ),
  cohort AS MATERIALIZED (
    SELECT c.*,EXISTS (SELECT 1 FROM public.profiles p,bounds b WHERE lower(p.email)=c.email AND p.created_at<b.to_ts) AS logged_in
    FROM public.adoption_designer_cohort_v2() c
  ),
  period_tx AS MATERIALIZED (
    SELECT t.user_id,t.coins,roulette_event.source FROM public.gamification_transactions t LEFT JOIN public.gamification_event_logs roulette_event ON roulette_event.id=t.event_id JOIN cohort c ON c.id=t.user_id CROSS JOIN bounds b
    WHERE (b.from_ts IS NULL OR t.created_at>=b.from_ts) AND t.created_at<b.to_ts
  ),
  days AS MATERIALIZED (SELECT generate_series(effective_from,p_to,interval '1 day')::date AS day FROM bounds),
  improvement_days AS MATERIALIZED (SELECT day FROM days WHERE day>=DATE '2026-07-01'),
  logins AS MATERIALIZED (
    SELECT c.id,min((p.created_at AT TIME ZONE 'Europe/Minsk')::date) login_day FROM cohort c LEFT JOIN public.profiles p ON lower(p.email)=c.email GROUP BY c.id
  ),
  status_source AS MATERIALIZED (
    SELECT s.user_id,s.date,s.status FROM public.ws_daily_statuses_baseline s JOIN cohort c ON c.id=s.user_id
      WHERE s.date BETWEEN DATE '2026-06-29' AND p_to
    UNION ALL
    SELECT s.user_id,s.date,s.status FROM public.ws_daily_statuses s JOIN cohort c ON c.id=s.user_id
      WHERE s.date BETWEEN DATE '2026-06-29' AND p_to
  ),
  ws_base AS MATERIALIZED (
    SELECT c.id,c.logged_in,count(*) FILTER (WHERE s.status='green')::numeric/NULLIF(count(*) FILTER (WHERE s.status IN ('green','red')),0) ratio
    FROM cohort c LEFT JOIN status_source s ON s.user_id=c.id AND s.date BETWEEN DATE '2026-06-29' AND DATE '2026-06-30'
    GROUP BY c.id,c.logged_in
  ),
  ws_grid AS MATERIALIZED (
    SELECT d.day,b.id,b.logged_in,b.ratio,
      COALESCE((s.status='green')::int,0) AS green_day,
      COALESCE((s.status IN ('green','red'))::int,0) AS tracked_day
    FROM improvement_days d CROSS JOIN ws_base b
    LEFT JOIN status_source s ON s.user_id=b.id AND s.date=d.day
  ),
  ws_running AS MATERIALIZED (
    SELECT day,id,logged_in,ratio,
      sum(green_day) OVER (PARTITION BY id ORDER BY day) AS green_total,
      sum(tracked_day) OVER (PARTITION BY id ORDER BY day) AS tracked_total
    FROM ws_grid
  ),
  ws_improved AS MATERIALIZED (
    SELECT day,logged_in,count(*) FILTER (WHERE green_total::numeric/NULLIF(tracked_total,0)>ratio)::bigint cnt
    FROM ws_running WHERE ratio IS NOT NULL GROUP BY day,logged_in
  ),
  ws_improved_day AS MATERIALIZED (
    SELECT day,sum(cnt)::bigint total,
      max(cnt) FILTER (WHERE logged_in)::bigint logged,
      max(cnt) FILTER (WHERE NOT logged_in)::bigint not_logged
    FROM ws_improved GROUP BY day
  ),
  calendar_days AS MATERIALIZED (
    SELECT d.day,(EXISTS (SELECT 1 FROM public.calendar_workdays w WHERE w.date=d.day)
      OR (extract(isodow FROM d.day) BETWEEN 1 AND 5 AND NOT EXISTS (SELECT 1 FROM public.calendar_holidays h WHERE h.date=d.day))) AS is_workday
    FROM improvement_days d
  ),
  rv_base AS MATERIALIZED (
    SELECT c.id,c.email,c.logged_in,COALESCE(sum(e.launch_count),0)::numeric/2 per_day
    FROM cohort c LEFT JOIN public.elk_plugin_launches_baseline e ON lower(e.user_email)=c.email AND e.work_date BETWEEN DATE '2026-06-29' AND DATE '2026-06-30'
    GROUP BY c.id,c.email,c.logged_in
  ),
  rv_daily AS MATERIALIZED (
    SELECT lower(e.user_email) email,e.work_date,sum(e.launch_count)::bigint launches
    FROM public.elk_plugin_launches e JOIN cohort c ON c.email=lower(e.user_email)
    WHERE e.work_date BETWEEN DATE '2026-07-01' AND p_to GROUP BY 1,2
  ),
  rv_grid AS MATERIALIZED (
    SELECT d.day,b.id,b.logged_in,b.per_day,d.is_workday,COALESCE(r.launches,0) launches
    FROM calendar_days d CROSS JOIN rv_base b LEFT JOIN rv_daily r ON r.email=b.email AND r.work_date=d.day
  ),
  rv_running AS MATERIALIZED (
    SELECT day,id,logged_in,per_day,
      sum(launches) OVER (PARTITION BY id ORDER BY day) launches_total,
      count(*) FILTER (WHERE is_workday) OVER (PARTITION BY id ORDER BY day) workdays_total
    FROM rv_grid
  ),
  rv_improved AS MATERIALIZED (
    SELECT day,logged_in,count(*) FILTER (WHERE launches_total::numeric/NULLIF(workdays_total,0)>per_day)::bigint cnt
    FROM rv_running GROUP BY day,logged_in
  ),
  rv_improved_day AS MATERIALIZED (
    SELECT day,sum(cnt)::bigint total,
      max(cnt) FILTER (WHERE logged_in)::bigint logged,
      max(cnt) FILTER (WHERE NOT logged_in)::bigint not_logged
    FROM rv_improved GROUP BY day
  ),
  all_workdays AS MATERIALIZED (
    SELECT d.day FROM days d WHERE EXISTS (SELECT 1 FROM public.calendar_workdays w WHERE w.date=d.day)
      OR (extract(isodow FROM d.day) BETWEEN 1 AND 5 AND NOT EXISTS (SELECT 1 FROM public.calendar_holidays h WHERE h.date=d.day))
  ),
  plugin_source AS MATERIALIZED (
    SELECT lower(e.user_email) email,e.work_date FROM public.elk_plugin_launches_baseline e,bounds b
      WHERE e.work_date BETWEEN b.effective_from AND p_to
    UNION
    SELECT lower(e.user_email),e.work_date FROM public.elk_plugin_launches e,bounds b
      WHERE e.work_date BETWEEN b.effective_from AND p_to
  ),
  overview_days AS MATERIALIZED (
    SELECT d.day,(SELECT count(*) FROM logins l WHERE l.login_day<=d.day)::bigint logged_in,
      w.total improved_ws,r.total improved_revit,
      w.logged improved_ws_logged,r.logged improved_revit_logged,
      w.not_logged improved_ws_not_logged,r.not_logged improved_revit_not_logged
    FROM days d
    LEFT JOIN ws_improved_day w ON w.day=d.day
    LEFT JOIN rv_improved_day r ON r.day=d.day
  ),
  revit_chart AS MATERIALIZED (
    SELECT w.day,count(p.email)::bigint users FROM all_workdays w
    LEFT JOIN plugin_source p ON p.work_date=w.day AND p.email IN (SELECT email FROM cohort) GROUP BY w.day
  )
  SELECT jsonb_build_object(
    'coverage',jsonb_build_object(
      'company_total',(SELECT count(*) FROM public.ws_users WHERE is_active=true),
      'total_employees',(SELECT count(*) FROM cohort),'profiles_count',(SELECT count(*) FROM cohort WHERE logged_in),
      'earned_total',(SELECT COALESCE(sum(coins) FILTER (WHERE coins>0 AND source IS DISTINCT FROM 'roulette'),0) FROM period_tx),
      'earned_logged',(SELECT COALESCE(sum(t.coins) FILTER (WHERE t.coins>0 AND t.source IS DISTINCT FROM 'roulette' AND c.logged_in),0) FROM period_tx t JOIN cohort c ON c.id=t.user_id),
      'earners',(SELECT count(DISTINCT user_id) FROM period_tx WHERE coins>0 AND source IS DISTINCT FROM 'roulette'),
      'spent_total',(SELECT COALESCE(-sum(coins) FILTER (WHERE coins<0),0) FROM period_tx),
      'balance_at_to',(SELECT COALESCE(sum(bal.total_coins),0)-COALESCE((SELECT sum(t.coins) FROM public.gamification_transactions t JOIN cohort c2 ON c2.id=t.user_id CROSS JOIN bounds bo WHERE t.created_at>=bo.to_ts),0) FROM public.gamification_balances bal JOIN cohort c ON c.id=bal.user_id)
    ),
    'overview',jsonb_build_object(
      'total_cohort',(SELECT count(*) FROM cohort),
      'users_daily',COALESCE((SELECT jsonb_agg(jsonb_build_object('day',day,'logged_in',logged_in,'improved_ws',improved_ws,'improved_revit',improved_revit,'improved_ws_logged',improved_ws_logged,'improved_revit_logged',improved_revit_logged,'improved_ws_not_logged',improved_ws_not_logged,'improved_revit_not_logged',improved_revit_not_logged) ORDER BY day) FROM overview_days),'[]'::jsonb),
      'revit_daily',COALESCE((SELECT jsonb_agg(jsonb_build_object('day',day,'users',users) ORDER BY day) FROM revit_chart),'[]'::jsonb),
      'login_users',COALESCE((SELECT jsonb_agg(jsonb_build_object('department',department,'team',team,'user_name',trim(COALESCE(last_name,'')||' '||COALESCE(first_name,'')),'logged_in',logged_in) ORDER BY department,team,logged_in,last_name,first_name) FROM cohort),'[]'::jsonb)
    )
  ) INTO v_result;
  RETURN v_result;
END;
$function$;
