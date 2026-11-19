-- Расчёт рейтингов на произвольную дату.
--
-- Достижения не умеют считать сами: fn_ach_snapshot_rankings читает матвью
-- view_top_*, а у тех окно периода жёстко привязано к fn_minsk_today().
-- Снапшот при этом подписывается вчерашним числом (fn_minsk_today() - 1).
-- Отсюда два расхождения:
--
-- 1. Обычный день. Отложенные награды за задачи (budget_ok_l3, deadline_ok_l3,
--    master_planner) приходят через 30 дней после закрытия задачи и получают
--    ranking_date = день начисления, то есть сегодня. Они создаются в том же
--    ночном прогоне за минуту до снапшота и попадают во вчерашний итог.
--    Подтверждённый случай — 16.10.2026 (восстановлен миграцией 139).
--
-- 2. Последний день месяца. В ночь на 1-е число окно матвью становится
--    [1-е; 1-е] нового месяца, и события за 31-е (ranking_date = 31-е) в него
--    не попадают вовсе. Вместо итога месяца записывается почти пустой набор.
--    Видно на 31.07 и 31.08.2026, за 30.09.2026 снапшота нет.
--
-- Функции ниже повторяют формулы матвью один в один, с единственным отличием:
-- период считается от переданной даты, а не от fn_minsk_today(). Способ
-- нумерации (dense_rank в личных, row_number в групповых) сохранён как есть —
-- разрешение ничьих меняется отдельным шагом, см. src/docs-features/
-- achievements/fix-snapshot-date-boundary.md.
--
-- Отсутствия берутся на p_date. Для view_top_team_ws это совпадает с текущим
-- поведением; для view_top_dept_ws и revit-вью (там absence_date =
-- fn_minsk_today() - 1) при вызове с p_date = v_today результат тот же.
--
-- Матвью здесь не трогаются: они обслуживают живой топ «на сегодня», и для
-- вкладки «Топы» это корректно.

-- Личный WS-рейтинг. Отсутствия не учитываются (как и в view_top_pers_ws).
CREATE OR REPLACE FUNCTION public.fn_rank_pers_ws(p_date date)
RETURNS TABLE (
  rank            bigint,
  user_id         uuid,
  email           text,
  first_name      text,
  last_name       text,
  department_code text,
  team            text,
  total_coins     bigint,
  period_start    date
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH user_coins AS (
    SELECT t.user_id          AS uid,
           wu.email           AS mail,
           wu.first_name      AS fname,
           wu.last_name       AS lname,
           wu.department_code AS dept,
           wu.team            AS tm,
           sum(t.coins)       AS coins
    FROM gamification_transactions t
    JOIN gamification_event_logs e ON e.id = t.event_id
    JOIN ws_users wu ON wu.id = t.user_id AND wu.is_active = true
    WHERE e.source = 'ws'
      AND e.ranking_date >= date_trunc('month', p_date)::date
      AND e.ranking_date <= p_date
      AND wu.team IS DISTINCT FROM 'Декретный'
    GROUP BY t.user_id, wu.email, wu.first_name, wu.last_name, wu.department_code, wu.team
  )
  SELECT dense_rank() OVER (ORDER BY uc.coins DESC),
         uc.uid, uc.mail, uc.fname, uc.lname, uc.dept, uc.tm,
         uc.coins::bigint,
         date_trunc('month', p_date)::date
  FROM user_coins uc
  WHERE uc.coins > 0;
$$;

-- Командный WS-рейтинг: сумма монет на сотрудника.
CREATE OR REPLACE FUNCTION public.fn_rank_team_ws(p_date date)
RETURNS TABLE (
  rank            bigint,
  team            text,
  users_earning   bigint,
  total_employees bigint,
  total_coins     bigint,
  contest_score   numeric,
  period_start    date
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH eligible_users AS (
    SELECT wu.id AS uid, wu.team AS tm
    FROM ws_users wu
    WHERE wu.is_active = true
      AND wu.team IS NOT NULL
      AND wu.team <> ''
      AND wu.team <> 'Декретный'
      AND NOT EXISTS (
        SELECT 1 FROM ws_user_absences a
        WHERE a.user_id = wu.id AND a.absence_date = p_date
      )
  ),
  team_totals AS (
    SELECT eu.tm, count(*)::bigint AS employees
    FROM eligible_users eu
    GROUP BY eu.tm
  ),
  team_coins AS (
    SELECT eu.tm,
           count(DISTINCT t.user_id)::bigint AS earners,
           sum(t.coins)::bigint              AS coins
    FROM gamification_transactions t
    JOIN gamification_event_logs e ON e.id = t.event_id
    JOIN eligible_users eu ON eu.uid = t.user_id
    WHERE e.source = 'ws'
      AND e.ranking_date >= date_trunc('month', p_date)::date
      AND e.ranking_date <= p_date
    GROUP BY eu.tm
  )
  SELECT row_number() OVER (
           ORDER BY round(COALESCE(tc.coins, 0)::numeric / tt.employees::numeric, 1) DESC
         ),
         tt.tm,
         COALESCE(tc.earners, 0::bigint),
         tt.employees,
         COALESCE(tc.coins, 0::bigint),
         round(COALESCE(tc.coins, 0)::numeric / tt.employees::numeric, 1),
         date_trunc('month', p_date)::date
  FROM team_totals tt
  LEFT JOIN team_coins tc ON tc.tm = tt.tm
  WHERE COALESCE(tc.coins, 0) > 0;
$$;

-- Отдельский WS-рейтинг.
CREATE OR REPLACE FUNCTION public.fn_rank_dept_ws(p_date date)
RETURNS TABLE (
  rank            bigint,
  department_code text,
  users_earning   bigint,
  total_employees bigint,
  total_coins     bigint,
  contest_score   numeric,
  period_start    date
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH eligible_users AS (
    SELECT wu.id AS uid, wu.department_code AS dept
    FROM ws_users wu
    WHERE wu.is_active = true
      AND wu.department_code IS NOT NULL
      AND wu.team IS DISTINCT FROM 'Декретный'
      AND NOT EXISTS (
        SELECT 1 FROM ws_user_absences a
        WHERE a.user_id = wu.id AND a.absence_date = p_date
      )
  ),
  dept_totals AS (
    SELECT eu.dept, count(*)::bigint AS employees
    FROM eligible_users eu
    GROUP BY eu.dept
  ),
  dept_coins AS (
    SELECT eu.dept,
           count(DISTINCT t.user_id)::bigint AS earners,
           sum(t.coins)::bigint              AS coins
    FROM gamification_transactions t
    JOIN gamification_event_logs e ON e.id = t.event_id
    JOIN eligible_users eu ON eu.uid = t.user_id
    WHERE e.source = 'ws'
      AND e.ranking_date >= date_trunc('month', p_date)::date
      AND e.ranking_date <= p_date
    GROUP BY eu.dept
  )
  SELECT row_number() OVER (
           ORDER BY round(COALESCE(dc.coins, 0)::numeric / dt.employees::numeric, 1) DESC
         ),
         dt.dept,
         COALESCE(dc.earners, 0::bigint),
         dt.employees,
         COALESCE(dc.coins, 0::bigint),
         round(COALESCE(dc.coins, 0)::numeric / dt.employees::numeric, 1),
         date_trunc('month', p_date)::date
  FROM dept_totals dt
  LEFT JOIN dept_coins dc ON dc.dept = dt.dept
  WHERE COALESCE(dc.coins, 0) > 0;
$$;

-- Личный Revit-рейтинг. Revit-события живут по event_date.
CREATE OR REPLACE FUNCTION public.fn_rank_pers_revit(p_date date)
RETURNS TABLE (
  rank            bigint,
  user_id         uuid,
  email           text,
  first_name      text,
  last_name       text,
  department_code text,
  team            text,
  total_coins     bigint,
  period_start    date
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH user_coins AS (
    SELECT t.user_id          AS uid,
           wu.email           AS mail,
           wu.first_name      AS fname,
           wu.last_name       AS lname,
           wu.department_code AS dept,
           wu.team            AS tm,
           sum(t.coins)       AS coins
    FROM gamification_transactions t
    JOIN gamification_event_logs e ON e.id = t.event_id
    JOIN ws_users wu ON wu.id = t.user_id AND wu.is_active = true
    WHERE e.source = 'revit'
      AND e.event_date >= date_trunc('month', p_date)::date
      AND e.event_date <= p_date
      AND wu.team IS DISTINCT FROM 'Декретный'
    GROUP BY t.user_id, wu.email, wu.first_name, wu.last_name, wu.department_code, wu.team
  )
  SELECT dense_rank() OVER (ORDER BY uc.coins DESC),
         uc.uid, uc.mail, uc.fname, uc.lname, uc.dept, uc.tm,
         uc.coins::bigint,
         date_trunc('month', p_date)::date
  FROM user_coins uc
  WHERE uc.coins > 0;
$$;

-- Командный Revit-рейтинг: счёт учитывает долю вовлечённых сотрудников.
CREATE OR REPLACE FUNCTION public.fn_rank_team_revit(p_date date)
RETURNS TABLE (
  rank            bigint,
  team            text,
  users_earning   bigint,
  total_employees bigint,
  total_coins     bigint,
  contest_score   numeric,
  period_start    date
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH eligible_users AS (
    SELECT wu.id AS uid, wu.team AS tm
    FROM ws_users wu
    WHERE wu.is_active = true
      AND wu.team IS NOT NULL
      AND wu.team <> ''
      AND wu.team <> 'Декретный'
      AND NOT EXISTS (
        SELECT 1 FROM ws_user_absences a
        WHERE a.user_id = wu.id AND a.absence_date = p_date
      )
  ),
  team_totals AS (
    SELECT eu.tm, count(*)::bigint AS employees
    FROM eligible_users eu
    GROUP BY eu.tm
  ),
  team_coins AS (
    SELECT eu.tm,
           count(DISTINCT t.user_id)::bigint AS earners,
           sum(t.coins)::bigint              AS coins
    FROM gamification_transactions t
    JOIN gamification_event_logs e ON e.id = t.event_id
    JOIN eligible_users eu ON eu.uid = t.user_id
    WHERE e.source = 'revit'
      AND e.event_date >= date_trunc('month', p_date)::date
      AND e.event_date <= p_date
    GROUP BY eu.tm
  )
  SELECT row_number() OVER (
           ORDER BY round(
             COALESCE(tc.coins, 0)::numeric
             * (COALESCE(tc.earners, 0)::numeric / tt.employees::numeric)
             / tt.employees::numeric, 1) DESC
         ),
         tt.tm,
         COALESCE(tc.earners, 0::bigint),
         tt.employees,
         COALESCE(tc.coins, 0::bigint),
         round(
           COALESCE(tc.coins, 0)::numeric
           * (COALESCE(tc.earners, 0)::numeric / tt.employees::numeric)
           / tt.employees::numeric, 1),
         date_trunc('month', p_date)::date
  FROM team_totals tt
  LEFT JOIN team_coins tc ON tc.tm = tt.tm
  WHERE COALESCE(tc.coins, 0) > 0;
$$;

-- Отдельский Revit-рейтинг.
CREATE OR REPLACE FUNCTION public.fn_rank_dept_revit(p_date date)
RETURNS TABLE (
  rank            bigint,
  department_code text,
  users_earning   bigint,
  total_employees bigint,
  total_coins     bigint,
  contest_score   numeric,
  period_start    date
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH eligible_users AS (
    SELECT wu.id AS uid, wu.department_code AS dept
    FROM ws_users wu
    WHERE wu.is_active = true
      AND wu.department_code IS NOT NULL
      AND wu.team IS DISTINCT FROM 'Декретный'
      AND NOT EXISTS (
        SELECT 1 FROM ws_user_absences a
        WHERE a.user_id = wu.id AND a.absence_date = p_date
      )
  ),
  dept_totals AS (
    SELECT eu.dept, count(*)::bigint AS employees
    FROM eligible_users eu
    GROUP BY eu.dept
  ),
  dept_coins AS (
    SELECT eu.dept,
           count(DISTINCT t.user_id)::bigint AS earners,
           sum(t.coins)::bigint              AS coins
    FROM gamification_transactions t
    JOIN gamification_event_logs e ON e.id = t.event_id
    JOIN eligible_users eu ON eu.uid = t.user_id
    WHERE e.source = 'revit'
      AND e.event_date >= date_trunc('month', p_date)::date
      AND e.event_date <= p_date
    GROUP BY eu.dept
  )
  SELECT row_number() OVER (
           ORDER BY round(
             COALESCE(dc.coins, 0)::numeric
             * (COALESCE(dc.earners, 0)::numeric / dt.employees::numeric)
             / dt.employees::numeric, 1) DESC
         ),
         dt.dept,
         COALESCE(dc.earners, 0::bigint),
         dt.employees,
         COALESCE(dc.coins, 0::bigint),
         round(
           COALESCE(dc.coins, 0)::numeric
           * (COALESCE(dc.earners, 0)::numeric / dt.employees::numeric)
           / dt.employees::numeric, 1),
         date_trunc('month', p_date)::date
  FROM dept_totals dt
  LEFT JOIN dept_coins dc ON dc.dept = dt.dept
  WHERE COALESCE(dc.coins, 0) > 0;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_rank_pers_ws(date)    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_rank_team_ws(date)    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_rank_dept_ws(date)    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_rank_pers_revit(date) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_rank_team_revit(date) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_rank_dept_revit(date) FROM anon, authenticated;
