-- 094_fix_ws_top_window_remove_plus1.sql
-- Баг: ВС-топы теряли транзакции с event_date = 1-е число месяца.
-- Матвью view_top_{pers,dept,team}_ws считали месяц окном
--   [date_trunc('month')+1 .. fn_minsk_today()]:
-- +1 на нижней границе (компенсация сдвига event_date триггером trg_fix_ws_event_date)
-- добавили 31.07.2026, но верхнюю границу не сдвинули → event_date = 1-е число
-- выпадало и из текущего месяца (нижняя = 2-е), и из прошлого (верхняя = последнее) →
-- мёртвая зона в 1 день на каждой границе месяца (кейс Зверока: топ 406 vs список 421).
--
-- Фикс (вариант B): убираем +1, окно = [date_trunc('month') .. today] по сырому event_date.
-- Это а) совпадает с окном функций розыгрыша fn_award_ws_{dept,team}_contest
--       (полный календарный месяц по event_date) — устраняет расхождение витрины и выплат;
--     б) единообразно с Revit-топами (у них +1 нет, т.к. revit event_date не сдвигается);
--     в) фактически откат миграции ws_top_window_compensate_plus1_trigger (31.07.2026).
-- Меняется одна строка WHERE в каждом матвью; колонки, индексы, contest_score — без изменений.

-- ── view_top_pers_ws ─────────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS view_top_pers_ws;
CREATE MATERIALIZED VIEW view_top_pers_ws AS
WITH user_coins AS (
  SELECT t.user_id, wu.email, wu.first_name, wu.last_name, wu.department_code, wu.team,
    sum(t.coins) AS total_coins
  FROM gamification_transactions t
  JOIN gamification_event_logs e ON e.id = t.event_id
  JOIN ws_users wu ON wu.id = t.user_id AND wu.is_active = true
  WHERE e.source = 'ws'
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

CREATE UNIQUE INDEX view_top_pers_ws_user_id_idx ON view_top_pers_ws (user_id);

-- ── view_top_dept_ws ─────────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS view_top_dept_ws;
CREATE MATERIALIZED VIEW view_top_dept_ws AS
WITH absent_yesterday AS (
  SELECT DISTINCT ws_user_absences.user_id
  FROM ws_user_absences
  WHERE ws_user_absences.absence_date = (fn_minsk_today() - 1)
), eligible_users AS (
  SELECT wu.id, wu.department_code
  FROM ws_users wu
  WHERE wu.is_active = true AND wu.department_code IS NOT NULL
    AND wu.team IS DISTINCT FROM 'Декретный'
    AND NOT (wu.id IN (SELECT absent_yesterday.user_id FROM absent_yesterday WHERE absent_yesterday.user_id IS NOT NULL))
), dept_totals AS (
  SELECT eligible_users.department_code, count(*) AS total_employees
  FROM eligible_users GROUP BY eligible_users.department_code
), dept_coins AS (
  SELECT eu.department_code, count(DISTINCT t.user_id) AS users_earning, sum(t.coins) AS total_coins
  FROM gamification_transactions t
  JOIN gamification_event_logs e ON e.id = t.event_id
  JOIN eligible_users eu ON eu.id = t.user_id
  WHERE e.source = 'ws'
    AND e.event_date >= date_trunc('month', fn_minsk_today()::timestamp without time zone)::date
    AND e.event_date <= fn_minsk_today()
  GROUP BY eu.department_code
)
SELECT row_number() OVER (ORDER BY (round(COALESCE(dc.total_coins, 0::bigint)::numeric / dt.total_employees::numeric, 1)) DESC) AS rank,
  dt.department_code,
  COALESCE(dc.users_earning, 0::bigint) AS users_earning,
  dt.total_employees,
  COALESCE(dc.total_coins, 0::bigint) AS total_coins,
  round(COALESCE(dc.total_coins, 0::bigint)::numeric / dt.total_employees::numeric, 1) AS contest_score,
  date_trunc('month', fn_minsk_today()::timestamp without time zone)::date AS period_start
FROM dept_totals dt
LEFT JOIN dept_coins dc ON dc.department_code = dt.department_code
WHERE COALESCE(dc.total_coins, 0::bigint) > 0;

CREATE UNIQUE INDEX view_top_dept_ws_department_code_idx ON view_top_dept_ws (department_code);

-- ── view_top_team_ws ─────────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS view_top_team_ws;
CREATE MATERIALIZED VIEW view_top_team_ws AS
WITH absent_today AS (
  SELECT DISTINCT ws_user_absences.user_id
  FROM ws_user_absences
  WHERE ws_user_absences.absence_date = fn_minsk_today()
), eligible_users AS (
  SELECT wu.id, wu.team
  FROM ws_users wu
  WHERE wu.is_active = true AND wu.team IS NOT NULL AND wu.team <> '' AND wu.team <> 'Декретный'
    AND NOT (wu.id IN (SELECT absent_today.user_id FROM absent_today WHERE absent_today.user_id IS NOT NULL))
), team_totals AS (
  SELECT eligible_users.team, count(*) AS total_employees
  FROM eligible_users GROUP BY eligible_users.team
), team_coins AS (
  SELECT wu.team, count(DISTINCT t.user_id) AS users_earning, sum(t.coins) AS total_coins
  FROM gamification_transactions t
  JOIN gamification_event_logs e ON e.id = t.event_id
  JOIN ws_users wu ON wu.id = t.user_id
  JOIN eligible_users eu ON eu.id = wu.id
  WHERE e.source = 'ws'
    AND e.event_date >= date_trunc('month', fn_minsk_today()::timestamp without time zone)::date
    AND e.event_date <= fn_minsk_today()
  GROUP BY wu.team
)
SELECT row_number() OVER (ORDER BY (round(COALESCE(tc.total_coins, 0::bigint)::numeric / tt.total_employees::numeric, 1)) DESC) AS rank,
  tt.team,
  COALESCE(tc.users_earning, 0::bigint) AS users_earning,
  tt.total_employees,
  COALESCE(tc.total_coins, 0::bigint) AS total_coins,
  round(COALESCE(tc.total_coins, 0::bigint)::numeric / tt.total_employees::numeric, 1) AS contest_score,
  date_trunc('month', fn_minsk_today()::timestamp without time zone)::date AS period_start
FROM team_totals tt
LEFT JOIN team_coins tc ON tc.team = tt.team
WHERE COALESCE(tc.total_coins, 0::bigint) > 0;

CREATE UNIQUE INDEX idx_top_team_ws_team ON view_top_team_ws (team);
CREATE INDEX idx_top_team_ws_rank ON view_top_team_ws (rank);
