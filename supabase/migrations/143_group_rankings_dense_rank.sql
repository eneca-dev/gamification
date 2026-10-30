-- Командные и отдельские рейтинги переходят на dense_rank.
--
-- Расхождение: фронтенд считает места через dense_rank
-- (DepartmentContest.tsx, applyDenseRank — при равном счёте команды делят
-- место), а база через row_number, где при равном счёте одна из команд просто
-- сдвигается ниже. Снапшот берёт rank <= 5 из базы, поэтому команда, которая
-- на экране пятая, в достижениях шестая и дня не получает.
--
-- Проявилось на «Команде ОВ гражд-1» 25–27.10.2026: «Дизайн и контент» и
-- «Вне команд ЭС гражд» шли ровно вровень (955.0 / 970.0 / 985.0) и занимали
-- в базе 4 и 5 место, вытесняя команду на шестое. На экране обе были
-- четвёртыми, а команда — пятой.
--
-- В личных рейтингах (fn_rank_pers_ws, fn_rank_pers_revit и соответствующие
-- матвью) dense_rank уже используется — эта миграция приводит командные и
-- отдельские к тому же правилу.
--
-- Матвью view_top_team_* и view_top_dept_* здесь не трогаются: на дашборде
-- места всё равно пересчитываются на клиенте через applyDenseRank. Их rank
-- влияет только на бейдж «#N» в блоке достижений.
--
-- Следствие: при ничьей внутри топ-5 в снапшот попадает больше пяти строк —
-- все, кто делит места. Ни у кого ранее засчитанный день не пропадает:
-- dense_rank при отсечке rank <= N всегда включает надмножество row_number.

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
  SELECT dense_rank() OVER (
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
  SELECT dense_rank() OVER (
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
  SELECT dense_rank() OVER (
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
  SELECT dense_rank() OVER (
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
