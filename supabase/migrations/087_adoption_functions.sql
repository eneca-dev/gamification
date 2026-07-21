-- Дашборд внедрения геймификации (/admin/adoption): все read-only SQL-функции.
-- Только CREATE OR REPLACE FUNCTION — таблицы и политики не меняются.
-- Когорта во всех метриках — активные проектировщики: отделы с group_type =
-- 'designer' из admin_department_groups. Период ДО = 29–30.06, ПОСЛЕ = с 01.07.
-- Вердикты — UNION ws_daily_statuses (живые, с 01.07) + ws_daily_statuses_baseline
-- (бэкфил 29–30.06, миграция 086).

-- ─────────────────────────── Когорта: хелперы ───────────────────────────

CREATE OR REPLACE FUNCTION adoption_designer_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT u.id
  FROM ws_users u
  JOIN admin_department_groups g ON g.department = u.department
  WHERE u.is_active = true AND g.group_type = 'designer';
$$;

CREATE OR REPLACE FUNCTION adoption_designer_emails()
RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT lower(u.email)
  FROM ws_users u
  JOIN admin_department_groups g ON g.department = u.department
  WHERE u.is_active = true AND g.group_type = 'designer' AND u.email IS NOT NULL;
$$;

-- ─────────────────────── Блок 1. Общая картина ───────────────────────

-- Охват: размер когорты, сколько авторизовались, сколько имеют баланс
CREATE OR REPLACE FUNCTION get_adoption_coverage()
RETURNS TABLE (total_employees bigint, profiles_count bigint, balances_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
    (SELECT COUNT(*) FROM adoption_designer_ids()),
    (SELECT COUNT(*) FROM profiles p
      WHERE lower(p.email) IN (SELECT adoption_designer_emails())),
    (SELECT COUNT(*) FROM gamification_balances b
      WHERE b.user_id IN (SELECT adoption_designer_ids()));
$$;

-- Заработано кристаллов когортой с p_from; сплит — доля суммы у вошедших в приложение
CREATE OR REPLACE FUNCTION get_adoption_earned(p_from date DEFAULT '2026-07-01')
RETURNS TABLE (earned_total bigint, earned_logged bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  WITH logged AS (
    SELECT u.id FROM ws_users u
    JOIN profiles p ON lower(p.email) = lower(u.email)
    WHERE u.id IN (SELECT adoption_designer_ids())
  )
  SELECT
    COALESCE(SUM(t.coins), 0)::bigint,
    COALESCE(SUM(t.coins) FILTER (WHERE t.user_id IN (SELECT id FROM logged)), 0)::bigint
  FROM gamification_transactions t
  WHERE t.user_id IN (SELECT adoption_designer_ids())
    AND t.coins > 0
    AND t.created_at >= p_from;
$$;

-- Активность в системе (блок 4): зарабатывающие, потрачено, сумма балансов
CREATE OR REPLACE FUNCTION get_adoption_crystal_stats(p_from date DEFAULT '2026-07-01')
RETURNS TABLE (earners bigint, spent_total bigint, balance_total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
    (SELECT COUNT(DISTINCT t.user_id) FROM gamification_transactions t
      WHERE t.user_id IN (SELECT adoption_designer_ids())
        AND t.coins > 0 AND t.created_at >= p_from)::bigint,
    (SELECT COALESCE(-SUM(t.coins), 0) FROM gamification_transactions t
      WHERE t.user_id IN (SELECT adoption_designer_ids())
        AND t.coins < 0 AND t.created_at >= p_from)::bigint,
    (SELECT COALESCE(SUM(b.total_coins), 0) FROM gamification_balances b
      WHERE b.user_id IN (SELECT adoption_designer_ids()))::bigint;
$$;

-- График «Вход в систему»: накопительно вошедшие и сделавшие активное действие
CREATE OR REPLACE FUNCTION get_adoption_users_daily(
  p_from date DEFAULT '2026-06-29',
  p_to   date DEFAULT CURRENT_DATE
)
RETURNS TABLE (day date, logged_in bigint, active_users bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  WITH days AS (
    SELECT generate_series(p_from, p_to, interval '1 day')::date AS day
  ),
  cohort_profiles AS (
    SELECT p.user_id, p.email, p.created_at::date AS login_date
    FROM profiles p
    WHERE lower(p.email) IN (SELECT adoption_designer_emails())
  ),
  first_actions AS (
    SELECT x.ws_user_id, MIN(x.created_at::date) AS first_action
    FROM (
      SELECT g.sender_id AS ws_user_id, g.created_at FROM gratitudes g
      UNION ALL
      SELECT o.user_id, o.created_at FROM shop_orders o WHERE o.status <> 'cancelled'
      UNION ALL
      SELECT u.id, c.created_at
      FROM chat_messages c
      JOIN profiles p ON p.user_id = c.user_id
      JOIN ws_users u ON lower(u.email) = lower(p.email)
      WHERE c.role = 'user'
    ) x
    WHERE x.ws_user_id IN (SELECT adoption_designer_ids())
    GROUP BY x.ws_user_id
  )
  SELECT
    d.day,
    (SELECT COUNT(*) FROM cohort_profiles WHERE login_date <= d.day)::bigint,
    (SELECT COUNT(*) FROM first_actions WHERE first_action <= d.day)::bigint
  FROM days d
  ORDER BY d.day;
$$;

-- Линии улучшений (раздельно вошедшие/не вошедшие): на дату D сколько человек
-- работают лучше своего же уровня 29–30.06 по WS и по частоте Revit-плагинов
CREATE OR REPLACE FUNCTION get_adoption_improved_daily_split(
  p_from date DEFAULT '2026-07-01',
  p_to   date DEFAULT CURRENT_DATE
)
RETURNS TABLE (day date, logged_in boolean, improved_ws bigint, improved_revit bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  WITH days AS (
    SELECT generate_series(p_from, p_to, interval '1 day')::date AS day
  ),
  workdays AS (
    SELECT x.day FROM (
      SELECT generate_series(p_from, p_to, interval '1 day')::date AS day
    ) x
    WHERE (extract(isodow FROM x.day) < 6
        AND x.day NOT IN (SELECT h.date FROM calendar_holidays h))
       OR x.day IN (SELECT w.date FROM calendar_workdays w)
  ),
  cohort AS (
    SELECT u.id, lower(u.email) AS email,
      EXISTS (SELECT 1 FROM profiles p WHERE lower(p.email) = lower(u.email)) AS li
    FROM ws_users u
    WHERE u.id IN (SELECT adoption_designer_ids())
  ),
  base_ws AS (
    SELECT b.user_id, c.li,
      COUNT(*) FILTER (WHERE b.status = 'green')::numeric AS g,
      COUNT(*) FILTER (WHERE b.status IN ('green', 'red'))::numeric AS t
    FROM ws_daily_statuses_baseline b
    JOIN cohort c ON c.id = b.user_id
    GROUP BY b.user_id, c.li
    HAVING COUNT(*) FILTER (WHERE b.status IN ('green', 'red')) > 0
  ),
  base_rv AS (
    SELECT lower(e.user_email) AS email,
      SUM(e.launch_count)::numeric / 2 AS per_day
    FROM elk_plugin_launches_baseline e
    WHERE e.work_date BETWEEN '2026-06-29' AND '2026-06-30'
      AND lower(e.user_email) IN (SELECT adoption_designer_emails())
    GROUP BY 1
  ),
  groups AS (
    SELECT true AS li UNION ALL SELECT false
  )
  SELECT
    d.day,
    gr.li,
    (SELECT COUNT(*) FROM base_ws b
      WHERE b.li = gr.li AND (
        SELECT COUNT(*) FILTER (WHERE s.status = 'green')::numeric
             / NULLIF(COUNT(*) FILTER (WHERE s.status IN ('green', 'red')), 0)
        FROM ws_daily_statuses s
        WHERE s.user_id = b.user_id AND s.date BETWEEN p_from AND d.day
      ) > b.g / b.t
    )::bigint,
    (SELECT COUNT(*) FROM (
        SELECT lower(e.user_email) AS email, SUM(e.launch_count)::numeric AS launches
        FROM elk_plugin_launches e
        WHERE e.work_date BETWEEN p_from AND d.day
          AND lower(e.user_email) IN (SELECT c.email FROM cohort c WHERE c.li = gr.li)
        GROUP BY 1
      ) a
      LEFT JOIN base_rv b ON b.email = a.email
      WHERE a.launches / GREATEST(
          (SELECT COUNT(*) FROM workdays w WHERE w.day <= d.day), 1
        ) > COALESCE(b.per_day, 0)
    )::bigint
  FROM days d
  CROSS JOIN groups gr
  ORDER BY d.day, gr.li;
$$;

-- Естественный фон улучшений ДО запуска: 29–30.06 против базового окна 25–26.06.
-- Вердикты базового окна вычисляются на лету по логике бэкфила (миграция 086).
CREATE OR REPLACE FUNCTION get_adoption_improved_prelaunch(
  p_base_from date DEFAULT '2026-06-25',
  p_base_to   date DEFAULT '2026-06-26',
  p_from      date DEFAULT '2026-06-29',
  p_to        date DEFAULT '2026-06-30'
)
RETURNS TABLE (day date, logged_in boolean, improved_ws bigint, improved_revit bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  WITH days AS (
    SELECT generate_series(p_from, p_to, interval '1 day')::date AS day
  ),
  base_days AS (
    SELECT generate_series(p_base_from, p_base_to, interval '1 day')::date AS day
  ),
  cohort AS (
    SELECT u.id, lower(u.email) AS email,
      EXISTS (SELECT 1 FROM profiles p WHERE lower(p.email) = lower(u.email)) AS li
    FROM ws_users u
    WHERE u.id IN (SELECT adoption_designer_ids())
  ),
  base_verdicts AS (
    SELECT c.id AS user_id, c.li, d.day,
      CASE
        WHEN EXISTS (SELECT 1 FROM ws_user_absences a
          WHERE a.user_id = c.id AND a.absence_date = d.day) THEN 'absent'
        WHEN NOT EXISTS (SELECT 1 FROM ws_daily_reports r
          WHERE r.user_id = c.id AND r.report_date = d.day)
          OR EXISTS (
            SELECT 1 FROM ws_daily_report_tasks drt
            WHERE drt.user_id = c.id AND drt.cost_date = d.day
              AND COALESCE(
                (SELECT sc.new_status FROM ws_task_status_changes sc
                  WHERE sc.ws_task_id = drt.ws_task_id AND sc.event_date <= d.day
                  ORDER BY sc.event_date DESC, sc.changed_at DESC LIMIT 1),
                (SELECT sc.old_status FROM ws_task_status_changes sc
                  WHERE sc.ws_task_id = drt.ws_task_id
                  ORDER BY sc.event_date ASC, sc.changed_at ASC LIMIT 1),
                (SELECT t.custom_status FROM ws_tasks_l3 t
                  WHERE t.ws_task_id = drt.ws_task_id LIMIT 1)
              ) IS DISTINCT FROM 'В работе'
          ) THEN 'red'
        ELSE 'green'
      END AS status
    FROM cohort c
    CROSS JOIN base_days d
  ),
  base_ws AS (
    SELECT v.user_id, v.li,
      COUNT(*) FILTER (WHERE v.status = 'green')::numeric AS g,
      COUNT(*) FILTER (WHERE v.status IN ('green', 'red'))::numeric AS t
    FROM base_verdicts v
    GROUP BY v.user_id, v.li
    HAVING COUNT(*) FILTER (WHERE v.status IN ('green', 'red')) > 0
  ),
  base_rv AS (
    SELECT lower(e.user_email) AS email,
      SUM(e.launch_count)::numeric / (SELECT COUNT(*) FROM base_days) AS per_day
    FROM elk_plugin_launches_baseline e
    WHERE e.work_date BETWEEN p_base_from AND p_base_to
      AND lower(e.user_email) IN (SELECT adoption_designer_emails())
    GROUP BY 1
  ),
  groups AS (
    SELECT true AS li UNION ALL SELECT false
  )
  SELECT
    d.day,
    gr.li,
    (SELECT COUNT(*) FROM base_ws b
      WHERE b.li = gr.li AND (
        SELECT COUNT(*) FILTER (WHERE s.status = 'green')::numeric
             / NULLIF(COUNT(*) FILTER (WHERE s.status IN ('green', 'red')), 0)
        FROM ws_daily_statuses_baseline s
        WHERE s.user_id = b.user_id AND s.date BETWEEN p_from AND d.day
      ) > b.g / b.t
    )::bigint,
    (SELECT COUNT(*) FROM (
        SELECT lower(e.user_email) AS email, SUM(e.launch_count)::numeric AS launches
        FROM elk_plugin_launches_baseline e
        WHERE e.work_date BETWEEN p_from AND d.day
          AND lower(e.user_email) IN (SELECT c.email FROM cohort c WHERE c.li = gr.li)
        GROUP BY 1
      ) a
      LEFT JOIN base_rv b ON b.email = a.email
      WHERE a.launches / GREATEST(
          (SELECT COUNT(*) FROM days w WHERE w.day <= d.day), 1
        ) > COALESCE(b.per_day, 0)
    )::bigint
  FROM days d
  CROSS JOIN groups gr
  ORDER BY d.day, gr.li;
$$;

-- График Revit: уникальные пользователи плагинов по дням (baseline до 30.06 + живой поток)
CREATE OR REPLACE FUNCTION get_adoption_revit_daily(
  p_from date DEFAULT '2026-06-29',
  p_to   date DEFAULT CURRENT_DATE
)
RETURNS TABLE (day date, users bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT t.work_date AS day, COUNT(DISTINCT lower(t.user_email))::bigint AS users
  FROM (
    SELECT user_email, work_date FROM elk_plugin_launches_baseline
    WHERE work_date BETWEEN p_from AND p_to
    UNION ALL
    SELECT user_email, work_date FROM elk_plugin_launches
    WHERE work_date BETWEEN p_from AND p_to
  ) t
  WHERE lower(t.user_email) IN (SELECT adoption_designer_emails())
  GROUP BY 1
  ORDER BY 1;
$$;

-- ────────────────── Блок 2. Дисциплина Worksection ──────────────────

-- Дневной ряд: отслеживаемые, зелёные, сдавшие отчёт день-в-день, доля часов «В работе»
CREATE OR REPLACE FUNCTION get_adoption_ws_daily(
  p_from date DEFAULT '2026-06-29',
  p_to   date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  day date, tracked bigint, green bigint, reported bigint,
  green_pct numeric, timely_pct numeric, inwork_pct numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  WITH src AS (
    SELECT s.user_id, s.date, s.status FROM ws_daily_statuses s
    WHERE s.date BETWEEN p_from AND p_to
      AND s.user_id IN (SELECT adoption_designer_ids())
    UNION ALL
    SELECT b.user_id, b.date, b.status FROM ws_daily_statuses_baseline b
    WHERE b.date BETWEEN p_from AND p_to
      AND b.user_id IN (SELECT adoption_designer_ids())
  ),
  days AS (
    SELECT s.date AS day,
      COUNT(*) FILTER (WHERE s.status IN ('green', 'red')) AS tracked,
      COUNT(*) FILTER (WHERE s.status = 'green') AS green,
      COUNT(*) FILTER (WHERE s.status IN ('green', 'red') AND r.user_id IS NOT NULL) AS reported
    FROM src s
    LEFT JOIN ws_daily_reports r
      ON r.user_id = s.user_id AND r.report_date = s.date
    GROUP BY s.date
  ),
  inwork AS (
    SELECT drt.cost_date AS day,
      SUM(drt.hours) AS hours_total,
      SUM(drt.hours) FILTER (WHERE COALESCE(
        (SELECT sc.new_status FROM ws_task_status_changes sc
          WHERE sc.ws_task_id = drt.ws_task_id AND sc.event_date <= drt.cost_date
          ORDER BY sc.event_date DESC, sc.changed_at DESC LIMIT 1),
        (SELECT sc.old_status FROM ws_task_status_changes sc
          WHERE sc.ws_task_id = drt.ws_task_id
          ORDER BY sc.event_date ASC, sc.changed_at ASC LIMIT 1),
        (SELECT t.custom_status FROM ws_tasks_l3 t
          WHERE t.ws_task_id = drt.ws_task_id LIMIT 1)
      ) = 'В работе') AS hours_inwork
    FROM ws_daily_report_tasks drt
    WHERE drt.cost_date BETWEEN p_from AND p_to
      AND drt.user_id IN (SELECT adoption_designer_ids())
    GROUP BY drt.cost_date
  )
  SELECT d.day, d.tracked, d.green, d.reported,
    ROUND(100.0 * d.green / NULLIF(d.tracked, 0), 1),
    ROUND(100.0 * d.reported / NULLIF(d.tracked, 0), 1),
    ROUND(100.0 * i.hours_inwork / NULLIF(i.hours_total, 0), 1)
  FROM days d
  LEFT JOIN inwork i ON i.day = d.day
  WHERE d.tracked > 0
  ORDER BY d.day;
$$;

-- Дневные счётчики красных причин (люди с нарушением): линии графика нарушений.
-- COUNT(DISTINCT user_id) — в живых вердиктах бывает несколько записей за день.
CREATE OR REPLACE FUNCTION get_adoption_red_reasons_daily(
  p_from date DEFAULT '2026-06-29',
  p_to   date DEFAULT CURRENT_DATE
)
RETURNS TABLE (day date, reason_type text, cnt bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  WITH src AS (
    SELECT user_id, date, status, red_reasons FROM ws_daily_statuses
    WHERE date BETWEEN p_from AND p_to
    UNION ALL
    SELECT user_id, date, status, red_reasons FROM ws_daily_statuses_baseline
    WHERE date BETWEEN p_from AND p_to
  )
  SELECT src.date AS day, reason->>'type' AS reason_type,
    COUNT(DISTINCT src.user_id)::bigint AS cnt
  FROM src,
    jsonb_array_elements(COALESCE(red_reasons, '[]'::jsonb)) AS reason
  WHERE status = 'red'
    AND user_id IN (SELECT adoption_designer_ids())
  GROUP BY src.date, reason_type
  ORDER BY src.date;
$$;

-- Скрытые списки нарушителей: люди с красными днями по причине, с числом дней.
-- Команда «Декретный» исключена — их отсутствие не фиксируется в ws_user_absences,
-- поэтому это пробел в данных WS, а не реальное нарушение.
CREATE OR REPLACE FUNCTION get_adoption_red_users(
  p_from date DEFAULT '2026-07-01',
  p_to   date DEFAULT CURRENT_DATE
)
RETURNS TABLE (reason_type text, user_name text, department text, days bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  WITH src AS (
    SELECT user_id, date, status, red_reasons FROM ws_daily_statuses
    WHERE date BETWEEN p_from AND p_to
    UNION ALL
    SELECT user_id, date, status, red_reasons FROM ws_daily_statuses_baseline
    WHERE date BETWEEN p_from AND p_to
  )
  SELECT
    reason->>'type' AS reason_type,
    TRIM(COALESCE(u.last_name, '') || ' ' || COALESCE(u.first_name, '')) AS user_name,
    u.department,
    COUNT(DISTINCT src.date)::bigint AS days
  FROM src
  JOIN ws_users u ON u.id = src.user_id
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(src.red_reasons, '[]'::jsonb)) AS reason
  WHERE src.status = 'red'
    AND src.user_id IN (SELECT adoption_designer_ids())
    AND u.team IS DISTINCT FROM 'Декретный'
  GROUP BY reason->>'type', u.id, u.last_name, u.first_name, u.department
  ORDER BY reason_type, days DESC, user_name;
$$;

-- Эффект вовлечения: доля зелёных дней ДО/ПОСЛЕ раздельно для вошедших и не вошедших
CREATE OR REPLACE FUNCTION get_adoption_login_effect(p_to date DEFAULT CURRENT_DATE)
RETURNS TABLE (logged_in boolean, users bigint, green_before_pct numeric, green_after_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  WITH cohort AS (
    SELECT u.id, lower(u.email) AS email
    FROM ws_users u
    WHERE u.id IN (SELECT adoption_designer_ids())
  ),
  logged AS (
    SELECT c.id FROM cohort c
    JOIN profiles p ON lower(p.email) = c.email
  ),
  src AS (
    SELECT s.user_id,
      s.user_id IN (SELECT l.id FROM logged l) AS li,
      s.date >= '2026-07-01' AS aft,
      s.status
    FROM (
      SELECT user_id, date, status FROM ws_daily_statuses
      UNION ALL
      SELECT user_id, date, status FROM ws_daily_statuses_baseline
    ) s
    WHERE s.user_id IN (SELECT adoption_designer_ids())
      AND s.status IN ('green', 'red')
      AND s.date <= p_to
  )
  SELECT li,
    COUNT(DISTINCT user_id),
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'green' AND NOT aft)
      / NULLIF(COUNT(*) FILTER (WHERE NOT aft), 0), 1),
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'green' AND aft)
      / NULLIF(COUNT(*) FILTER (WHERE aft), 0), 1)
  FROM src
  GROUP BY li
  ORDER BY li;
$$;

-- Вход по отделам/командам: агрегаты для скрытого вложенного списка
CREATE OR REPLACE FUNCTION get_adoption_login_by_department()
RETURNS TABLE (department text, team text, total bigint, logged_in bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
    u.department,
    NULLIF(u.team, '') AS team,
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (
      WHERE EXISTS (SELECT 1 FROM profiles p WHERE lower(p.email) = lower(u.email))
    )::bigint AS logged_in
  FROM ws_users u
  WHERE u.id IN (SELECT adoption_designer_ids())
  GROUP BY u.department, NULLIF(u.team, '')
  ORDER BY u.department, NULLIF(u.team, '');
$$;

-- Вход пофамильно: раскрытие команды в список людей (не вошедшие первыми)
CREATE OR REPLACE FUNCTION get_adoption_login_users()
RETURNS TABLE (department text, team text, user_name text, logged_in boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
    u.department,
    NULLIF(u.team, '') AS team,
    TRIM(COALESCE(u.last_name, '') || ' ' || COALESCE(u.first_name, '')) AS user_name,
    EXISTS (SELECT 1 FROM profiles p WHERE lower(p.email) = lower(u.email)) AS logged_in
  FROM ws_users u
  WHERE u.id IN (SELECT adoption_designer_ids())
  ORDER BY u.department, NULLIF(u.team, ''), logged_in, user_name;
$$;
