-- Исправление: ROW_NUMBER → DENSE_RANK в личных рейтингах (Revit и WS).
-- Проблема: ROW_NUMBER при одинаковом счёте назначает разные ранги произвольно.
-- В начале месяца десятки людей имеют равный счёт — в снапшот достижений попадали
-- только первые 10 по порядку вставки. Остальные не получали день к достижению.
-- Решение: DENSE_RANK — все с одинаковым счётом получают одинаковый ранг,
-- и все они захватываются снапшотом (rank <= 10).

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
    AND e.event_date >= date_trunc('month', (fn_minsk_today() - 1)::timestamp without time zone)::date
    AND e.event_date <= (fn_minsk_today() - 1)
    AND wu.team IS DISTINCT FROM 'Декретный'
  GROUP BY t.user_id, wu.email, wu.first_name, wu.last_name, wu.department_code, wu.team
)
SELECT dense_rank() OVER (ORDER BY total_coins DESC) AS rank,
  user_id, email, first_name, last_name, department_code, team, total_coins,
  date_trunc('month', (fn_minsk_today() - 1)::timestamp without time zone)::date AS period_start
FROM user_coins
WHERE total_coins > 0;

CREATE UNIQUE INDEX idx_top_pers_revit_uid ON view_top_pers_revit (user_id);
CREATE INDEX idx_top_pers_revit_rank ON view_top_pers_revit (rank);

-- ── view_top_pers_ws ─────────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS view_top_pers_ws CASCADE;
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
