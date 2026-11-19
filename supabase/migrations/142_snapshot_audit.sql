-- Аудит ночного снапшота достижений.
--
-- Потерю дня 16.10.2026 заметил пользователь спустя 11 дней: в
-- ach_ranking_snapshots не было ни времени записи, ни механизма проверки, а
-- ON CONFLICT DO NOTHING означает, что однажды записанная неверная строка уже
-- не перезапишется. Эта миграция добавляет и то, и другое.
--
-- created_at добавляется БЕЗ значения по умолчанию, и только затем default
-- навешивается отдельным ALTER: иначе PostgreSQL 11+ подставил бы now() всем
-- существующим строкам и соврал бы про время их появления. У старых строк
-- остаётся NULL — «время неизвестно».
--
-- fn_ach_audit_snapshot(p_date) сравнивает записанный состав топа за дату с
-- пересчётом через fn_rank_* на ту же дату. Вызывается из compute-achievements
-- сразу после снапшота, расхождения уходят в телеграм-отчёт блока Achievements
-- как предупреждения.

ALTER TABLE public.ach_ranking_snapshots
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

ALTER TABLE public.ach_ranking_snapshots
  ALTER COLUMN created_at SET DEFAULT now();

COMMENT ON COLUMN public.ach_ranking_snapshots.created_at IS
  'Когда строка была записана. NULL у строк, созданных до появления колонки.';

CREATE OR REPLACE FUNCTION public.fn_ach_audit_snapshot(p_date date)
RETURNS TABLE (
  area        text,
  entity_type text,
  problem     text,
  entity_id   text,
  detail      text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  -- WS / user (топ-10, score = сумма монет)
  ws_user AS (
    SELECT 'ws'::text AS ar, 'user'::text AS et,
           CASE WHEN s.entity_id IS NULL THEN 'missing'
                WHEN f.user_id  IS NULL THEN 'extra'
                ELSE 'score' END AS pr,
           COALESCE(f.user_id::text, s.entity_id) AS eid,
           format('расчёт: rank=%s score=%s / записано: rank=%s score=%s',
                  COALESCE(f.rank::text, '—'), COALESCE(f.total_coins::text, '—'),
                  COALESCE(s.rank::text, '—'), COALESCE(s.score::text, '—')) AS dt
    FROM (SELECT user_id, rank, total_coins FROM fn_rank_pers_ws(p_date) WHERE rank <= 10) f
    FULL JOIN (SELECT entity_id, rank, score FROM ach_ranking_snapshots
               WHERE area = 'ws' AND entity_type = 'user' AND snapshot_date = p_date) s
      ON s.entity_id = f.user_id::text
    WHERE s.entity_id IS NULL OR f.user_id IS NULL OR s.score <> f.total_coins
  ),
  -- WS / team (топ-5, score = contest_score)
  ws_team AS (
    SELECT 'ws', 'team',
           CASE WHEN s.entity_id IS NULL THEN 'missing'
                WHEN f.team     IS NULL THEN 'extra'
                ELSE 'score' END,
           COALESCE(f.team, s.entity_id),
           format('расчёт: rank=%s score=%s / записано: rank=%s score=%s',
                  COALESCE(f.rank::text, '—'), COALESCE(f.contest_score::text, '—'),
                  COALESCE(s.rank::text, '—'), COALESCE(s.score::text, '—'))
    FROM (SELECT team, rank, contest_score FROM fn_rank_team_ws(p_date) WHERE rank <= 5) f
    FULL JOIN (SELECT entity_id, rank, score FROM ach_ranking_snapshots
               WHERE area = 'ws' AND entity_type = 'team' AND snapshot_date = p_date) s
      ON s.entity_id = f.team
    WHERE s.entity_id IS NULL OR f.team IS NULL OR s.score <> f.contest_score
  ),
  -- WS / department
  ws_dept AS (
    SELECT 'ws', 'department',
           CASE WHEN s.entity_id       IS NULL THEN 'missing'
                WHEN f.department_code IS NULL THEN 'extra'
                ELSE 'score' END,
           COALESCE(f.department_code, s.entity_id),
           format('расчёт: rank=%s score=%s / записано: rank=%s score=%s',
                  COALESCE(f.rank::text, '—'), COALESCE(f.contest_score::text, '—'),
                  COALESCE(s.rank::text, '—'), COALESCE(s.score::text, '—'))
    FROM (SELECT department_code, rank, contest_score FROM fn_rank_dept_ws(p_date) WHERE rank <= 5) f
    FULL JOIN (SELECT entity_id, rank, score FROM ach_ranking_snapshots
               WHERE area = 'ws' AND entity_type = 'department' AND snapshot_date = p_date) s
      ON s.entity_id = f.department_code
    WHERE s.entity_id IS NULL OR f.department_code IS NULL OR s.score <> f.contest_score
  ),
  -- REVIT / user: повторяем двойное условие снапшота (топ по 💎 И топ по запускам)
  revit_user AS (
    SELECT 'revit', 'user',
           CASE WHEN s.entity_id IS NULL THEN 'missing'
                WHEN f.user_id  IS NULL THEN 'extra'
                ELSE 'score' END,
           COALESCE(f.user_id::text, s.entity_id),
           format('расчёт: rank=%s score=%s / записано: rank=%s score=%s',
                  COALESCE(f.rank::text, '—'), COALESCE(f.total_coins::text, '—'),
                  COALESCE(s.rank::text, '—'), COALESCE(s.score::text, '—'))
    FROM (
      SELECT p.user_id, p.rank, p.total_coins
      FROM fn_rank_pers_revit(p_date) p
      WHERE p.rank <= 10
        AND (
          (SELECT secondary_rank_limit FROM ach_ranking_settings
           WHERE area = 'revit' AND entity_type = 'user' AND is_active = true) IS NULL
          OR EXISTS (
            SELECT 1 FROM fn_revit_launches_rank(p_date) l
            WHERE l.user_id = p.user_id
              AND l.rnk <= (SELECT secondary_rank_limit FROM ach_ranking_settings
                            WHERE area = 'revit' AND entity_type = 'user' AND is_active = true)
          )
        )
    ) f
    FULL JOIN (SELECT entity_id, rank, score FROM ach_ranking_snapshots
               WHERE area = 'revit' AND entity_type = 'user' AND snapshot_date = p_date) s
      ON s.entity_id = f.user_id::text
    WHERE s.entity_id IS NULL OR f.user_id IS NULL OR s.score <> f.total_coins
  ),
  -- REVIT / team
  revit_team AS (
    SELECT 'revit', 'team',
           CASE WHEN s.entity_id IS NULL THEN 'missing'
                WHEN f.team     IS NULL THEN 'extra'
                ELSE 'score' END,
           COALESCE(f.team, s.entity_id),
           format('расчёт: rank=%s score=%s / записано: rank=%s score=%s',
                  COALESCE(f.rank::text, '—'), COALESCE(f.contest_score::text, '—'),
                  COALESCE(s.rank::text, '—'), COALESCE(s.score::text, '—'))
    FROM (SELECT team, rank, contest_score FROM fn_rank_team_revit(p_date) WHERE rank <= 5) f
    FULL JOIN (SELECT entity_id, rank, score FROM ach_ranking_snapshots
               WHERE area = 'revit' AND entity_type = 'team' AND snapshot_date = p_date) s
      ON s.entity_id = f.team
    WHERE s.entity_id IS NULL OR f.team IS NULL OR s.score <> f.contest_score
  ),
  -- REVIT / department
  revit_dept AS (
    SELECT 'revit', 'department',
           CASE WHEN s.entity_id       IS NULL THEN 'missing'
                WHEN f.department_code IS NULL THEN 'extra'
                ELSE 'score' END,
           COALESCE(f.department_code, s.entity_id),
           format('расчёт: rank=%s score=%s / записано: rank=%s score=%s',
                  COALESCE(f.rank::text, '—'), COALESCE(f.contest_score::text, '—'),
                  COALESCE(s.rank::text, '—'), COALESCE(s.score::text, '—'))
    FROM (SELECT department_code, rank, contest_score FROM fn_rank_dept_revit(p_date) WHERE rank <= 5) f
    FULL JOIN (SELECT entity_id, rank, score FROM ach_ranking_snapshots
               WHERE area = 'revit' AND entity_type = 'department' AND snapshot_date = p_date) s
      ON s.entity_id = f.department_code
    WHERE s.entity_id IS NULL OR f.department_code IS NULL OR s.score <> f.contest_score
  )
  SELECT * FROM ws_user
  UNION ALL SELECT * FROM ws_team
  UNION ALL SELECT * FROM ws_dept
  UNION ALL SELECT * FROM revit_user
  UNION ALL SELECT * FROM revit_team
  UNION ALL SELECT * FROM revit_dept;
$$;

ALTER FUNCTION public.fn_ach_audit_snapshot(date) SET statement_timeout TO '30s';

REVOKE EXECUTE ON FUNCTION public.fn_ach_audit_snapshot(date) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_ach_audit_snapshot(date) TO service_role;
