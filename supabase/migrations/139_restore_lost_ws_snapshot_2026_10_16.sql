-- Восстановление потерянного дня 2026-10-16 в WS-снапшотах достижений.
--
-- Причина потери: fn_ach_snapshot_rankings подписывает снапшот вчерашним
-- числом (v_today = fn_minsk_today() - 1), но читает матвью view_top_*_ws,
-- у которых верхняя граница — ranking_date <= fn_minsk_today(), то есть
-- сегодня. Отложенные награды за задачи (budget_ok_l3, deadline_ok_l3,
-- master_planner) получают ranking_date = день начисления и создаются в том
-- же ночном прогоне за минуту до снапшота.
--
-- В ночь на 17.10 упал крупнейший за месяц пакет таких наград (38 budget_ok_l3,
-- 40 deadline_ok_l3, 3 master_planner). Команды ВК-6 (+1115) и ВК-4 (+1432)
-- подскочили и попали в снапшот с меткой 16.10, вытеснив тех, кто был в топе
-- 16-го на самом деле. Снапшот за 16.10 в итоге совпал со снапшотом за 17.10
-- строка в строку.
--
-- Правим только добором строк. Фантомные строки ВК-6/ВК-4/ВК не удаляем:
-- иначе у них на экране просядет счётчик, а выданные им 25.10 награды
-- (ach_awards, 10 дней) останутся без основания. У обеих команд 11 дней, так
-- что добор ничего не ломает. Принцип тот же, что в 114: ранее выданное
-- сохраняем.
--
-- Пороги не пересекает никто: ОВ гражд-1 4 -> 5 из 10, Разработка - JS/TS
-- 6 -> 7 из 10, BIM 5 -> 6 из 10, у добавляемых людей максимум 15 из 20.
-- Новых начислений и событий в ленте не будет.

-- Бэкап октябрьских снапшотов перед правкой.
CREATE TABLE IF NOT EXISTS public.ach_ranking_snapshots_bak_20261027 AS
SELECT *
FROM public.ach_ranking_snapshots
WHERE period_start = DATE '2026-10-01';

-- Командный уровень.
-- Команда ОВ гражд-1:  2572 монеты / 4 человека = 643.0
-- Разработка - JS/TS:  1840 монет  / 3 человека = 613.3
INSERT INTO public.ach_ranking_snapshots
  (entity_id, entity_type, area, rank, score, snapshot_date, period_start)
VALUES
  ('Команда ОВ гражд-1', 'team', 'ws', 4, 643.0, DATE '2026-10-16', DATE '2026-10-01'),
  ('Разработка - JS/TS', 'team', 'ws', 5, 613.3, DATE '2026-10-16', DATE '2026-10-01')
ON CONFLICT (entity_id, entity_type, area, snapshot_date) DO NOTHING;

-- Отдельский уровень.
INSERT INTO public.ach_ranking_snapshots
  (entity_id, entity_type, area, rank, score, snapshot_date, period_start)
VALUES
  ('BIM', 'department', 'ws', 5, 339.5, DATE '2026-10-16', DATE '2026-10-01')
ON CONFLICT (entity_id, entity_type, area, snapshot_date) DO NOTHING;

-- Личный топ-10: считаем из событий по монетам с ranking_date <= 16.10.
WITH user_coins AS (
  SELECT t.user_id, sum(t.coins) AS coins
  FROM public.gamification_transactions t
  JOIN public.gamification_event_logs g ON g.id = t.event_id
  JOIN public.ws_users wu ON wu.id = t.user_id
                         AND wu.is_active = true
                         AND wu.team IS DISTINCT FROM 'Декретный'
  WHERE g.source = 'ws'
    AND g.ranking_date BETWEEN DATE '2026-10-01' AND DATE '2026-10-16'
  GROUP BY t.user_id
),
ranked AS (
  SELECT user_id, coins, dense_rank() OVER (ORDER BY coins DESC) AS rnk
  FROM user_coins
  WHERE coins > 0
)
INSERT INTO public.ach_ranking_snapshots
  (entity_id, entity_type, area, rank, score, snapshot_date, period_start)
SELECT user_id::text, 'user', 'ws', rnk::smallint, coins::numeric,
       DATE '2026-10-16', DATE '2026-10-01'
FROM ranked
WHERE rnk <= 10
ON CONFLICT (entity_id, entity_type, area, snapshot_date) DO NOTHING;
