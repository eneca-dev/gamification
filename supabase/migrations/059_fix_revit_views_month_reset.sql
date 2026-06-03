-- Исправление: убираем сдвиг -1 из фильтра event_date в Revit-матвью.
--
-- Проблема: все три Revit matview использовали (fn_minsk_today() - 1) как верхнюю
-- границу дат, что приводило к тому, что date_trunc('month', ...) на 1-е число
-- месяца вычислялся от последнего дня предыдущего месяца — и топ показывал
-- весь предыдущий месяц вместо сброса.
--
-- WS-матвью всегда использовали fn_minsk_today() без сдвига и сбрасывались корректно.
-- Данные Revit всегда имеют event_date = вчера (плагин синхронизируется ночью),
-- поэтому фильтр event_date <= fn_minsk_today() даёт тот же результат в течение
-- месяца, но корректно сбрасывает топ 1-го числа.

-- ── view_top_pers_revit ──────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS view_top_pers_revit CASCADE;
CREATE MATERIALIZED VIEW view_top_pers_revit AS
WITH user_coins AS (
  SELECT t.user_id, wu.email, wu.first_name, wu.last_name, wu.department_code, wu.team,
    sum(t.coins) AS total_coins
  FROM gamification_transactions t
  JOIN gamification_event_logs e ON e.id = t.event_id
  JOIN ws_users wu ON wu.id = t.user_id AND wu.is_active = true
  WHERE e.source = 'revit'
    AND e.event_date >= date_trunc('month', fn_minsk_today()::timestamp without time zone)::date
    AND e.event_date <= fn_minsk_today()
    AND wu.team IS DISTINCT FROM 'Декретный'
  GROUP BY t.user_id, wu.email, wu.first_name, wu.last_name, wu.department_code, wu.team
)
SELECT dense_rank() OVER (ORDER BY total_coins DESC) AS rank,
  user_id, email, first_name, last_name, department_code, team, total_coins,
  date_trunc('month', fn_minsk_today()::timestamp without time zone)::date AS period_start
FROM user_coins
WHERE total_coins > 0;

CREATE UNIQUE INDEX idx_top_pers_revit_uid ON view_top_pers_revit (user_id);
CREATE INDEX idx_top_pers_revit_rank ON view_top_pers_revit (rank);

-- ── view_top_team_revit ──────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS view_top_team_revit CASCADE;
CREATE MATERIALIZED VIEW view_top_team_revit AS
WITH absent_yesterday AS (
  SELECT DISTINCT user_id
  FROM ws_user_absences
  WHERE absence_date = (fn_minsk_today() - 1)
), eligible_users AS (
  SELECT wu.id, wu.team
  FROM ws_users wu
  WHERE wu.is_active = true
    AND wu.team IS NOT NULL AND wu.team <> '' AND wu.team <> 'Декретный'
    AND NOT (wu.id IN (SELECT user_id FROM absent_yesterday WHERE user_id IS NOT NULL))
), team_totals AS (
  SELECT team, count(*) AS total_employees
  FROM eligible_users
  GROUP BY team
), team_coins AS (
  SELECT wu.team,
    count(DISTINCT t.user_id) AS users_earning,
    sum(t.coins) AS total_coins
  FROM gamification_transactions t
  JOIN gamification_event_logs e ON e.id = t.event_id
  JOIN ws_users wu ON wu.id = t.user_id
  JOIN eligible_users eu ON eu.id = wu.id
  WHERE e.source = 'revit'
    AND e.event_date >= date_trunc('month', fn_minsk_today()::timestamp without time zone)::date
    AND e.event_date <= fn_minsk_today()
  GROUP BY wu.team
)
SELECT row_number() OVER (ORDER BY (round(COALESCE(tc.total_coins, 0)::numeric * (COALESCE(tc.users_earning, 0)::numeric / tt.total_employees::numeric) / tt.total_employees::numeric, 1)) DESC) AS rank,
  tt.team,
  COALESCE(tc.users_earning, 0) AS users_earning,
  tt.total_employees,
  COALESCE(tc.total_coins, 0) AS total_coins,
  round(COALESCE(tc.total_coins, 0)::numeric * (COALESCE(tc.users_earning, 0)::numeric / tt.total_employees::numeric) / tt.total_employees::numeric, 1) AS contest_score,
  date_trunc('month', fn_minsk_today()::timestamp without time zone)::date AS period_start
FROM team_totals tt
LEFT JOIN team_coins tc ON tc.team = tt.team
WHERE COALESCE(tc.total_coins, 0) > 0;

CREATE UNIQUE INDEX view_top_team_revit_team_idx ON view_top_team_revit (team);

-- ── view_top_dept_revit ──────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS view_top_dept_revit CASCADE;
CREATE MATERIALIZED VIEW view_top_dept_revit AS
WITH absent_yesterday AS (
  SELECT DISTINCT user_id
  FROM ws_user_absences
  WHERE absence_date = (fn_minsk_today() - 1)
), eligible_users AS (
  SELECT wu.id, wu.department_code
  FROM ws_users wu
  WHERE wu.is_active = true
    AND wu.department_code IS NOT NULL
    AND wu.team IS DISTINCT FROM 'Декретный'
    AND NOT (wu.id IN (SELECT user_id FROM absent_yesterday WHERE user_id IS NOT NULL))
), dept_totals AS (
  SELECT department_code, count(*) AS total_employees
  FROM eligible_users
  GROUP BY department_code
), dept_coins AS (
  SELECT eu.department_code,
    count(DISTINCT t.user_id) AS users_earning,
    sum(t.coins) AS total_coins
  FROM gamification_transactions t
  JOIN gamification_event_logs e ON e.id = t.event_id
  JOIN eligible_users eu ON eu.id = t.user_id
  WHERE e.source = 'revit'
    AND e.event_date >= date_trunc('month', fn_minsk_today()::timestamp without time zone)::date
    AND e.event_date <= fn_minsk_today()
  GROUP BY eu.department_code
)
SELECT row_number() OVER (ORDER BY (round(COALESCE(dc.total_coins, 0)::numeric * (COALESCE(dc.users_earning, 0)::numeric / dt.total_employees::numeric) / dt.total_employees::numeric, 1)) DESC) AS rank,
  dt.department_code,
  COALESCE(dc.users_earning, 0) AS users_earning,
  dt.total_employees,
  COALESCE(dc.total_coins, 0) AS total_coins,
  round(COALESCE(dc.total_coins, 0)::numeric * (COALESCE(dc.users_earning, 0)::numeric / dt.total_employees::numeric) / dt.total_employees::numeric, 1) AS contest_score,
  date_trunc('month', fn_minsk_today()::timestamp without time zone)::date AS period_start
FROM dept_totals dt
LEFT JOIN dept_coins dc ON dc.department_code = dt.department_code
WHERE COALESCE(dc.total_coins, 0) > 0;

CREATE UNIQUE INDEX view_top_dept_revit_department_code_idx ON view_top_dept_revit (department_code);

-- Немедленно обновляем view — сейчас они должны быть пустыми (нет данных за июнь).
-- VPS заполнит их после ночного прогона.
REFRESH MATERIALIZED VIEW view_top_pers_revit;
REFRESH MATERIALIZED VIEW view_top_team_revit;
REFRESH MATERIALIZED VIEW view_top_dept_revit;