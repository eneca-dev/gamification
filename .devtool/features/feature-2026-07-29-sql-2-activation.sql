-- ЭТАП 2 — АКТИВАЦИЯ. Применять ТОЛЬКО в пятницу, прямо перед/во время деплоя.
-- До этого момента приложение продолжает работать по старым правилам (топ-10, 10 дней,
-- только по 💎), даже если ЭТАП 1 уже применён — новые объекты просто ещё не подключены.
--
-- Порядок применения: сначала весь этот файл целиком, потом сразу деплой фронта
-- (или наоборот — порядок между собой не важен, важно что оба должны случиться в одно окно).

-- 1. fn_ach_snapshot_rankings() — переписана только в блоке REVIT/user: добавлено
--    условие "И топ по запускам" через secondary_rank_limit. Всё остальное (WS,
--    команды, отделы, начисление 💎, идемпотентность) — без изменений, 1:1 со старой версией.
CREATE OR REPLACE FUNCTION public.fn_ach_snapshot_rankings()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := fn_minsk_today() - 1;
  v_period_start date;
  v_top_personal int := 10;
  v_top_group int := 5;
  v_snap_count int := 0;
  v_awarded_count int := 0;
  v_rec RECORD;
  v_bonus int;
  v_event_id uuid;
  v_emp RECORD;
  v_tmp int;
  v_threshold int;
  v_secondary_limit int;
BEGIN
  v_period_start := fn_ach_period_start(v_today);

  REFRESH MATERIALIZED VIEW CONCURRENTLY view_top_pers_revit;
  REFRESH MATERIALIZED VIEW CONCURRENTLY view_top_pers_ws;
  REFRESH MATERIALIZED VIEW CONCURRENTLY view_top_team_revit;
  REFRESH MATERIALIZED VIEW CONCURRENTLY view_top_team_ws;
  REFRESH MATERIALIZED VIEW CONCURRENTLY view_top_dept_revit;
  REFRESH MATERIALIZED VIEW CONCURRENTLY view_top_dept_ws;

  -- REVIT / user — ⬇⬇⬇ ИЗМЕНЁННЫЙ БЛОК: двойное условие ⬇⬇⬇
  SELECT secondary_rank_limit INTO v_secondary_limit
  FROM ach_ranking_settings WHERE area = 'revit' AND entity_type = 'user' AND is_active = true;

  INSERT INTO ach_ranking_snapshots (entity_id, entity_type, area, rank, score, snapshot_date, period_start)
  SELECT p.user_id::text, 'user', 'revit', p.rank::smallint, p.total_coins, v_today, v_period_start
  FROM view_top_pers_revit p
  WHERE p.rank <= v_top_personal
    AND (
      v_secondary_limit IS NULL  -- подстраховка: если порог не задан — старое поведение
      OR EXISTS (
        SELECT 1 FROM fn_revit_launches_rank(v_today) l
        WHERE l.user_id = p.user_id AND l.rnk <= v_secondary_limit
      )
    )
  ON CONFLICT (entity_id, entity_type, area, snapshot_date) DO NOTHING;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_snap_count := v_snap_count + v_tmp;
  -- ⬆⬆⬆ КОНЕЦ ИЗМЕНЁННОГО БЛОКА ⬆⬆⬆

  -- REVIT / team, department — без изменений
  INSERT INTO ach_ranking_snapshots (entity_id, entity_type, area, rank, score, snapshot_date, period_start)
  SELECT team, 'team', 'revit', rank::smallint, contest_score, v_today, v_period_start
  FROM view_top_team_revit WHERE rank <= v_top_group
  ON CONFLICT (entity_id, entity_type, area, snapshot_date) DO NOTHING;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_snap_count := v_snap_count + v_tmp;

  INSERT INTO ach_ranking_snapshots (entity_id, entity_type, area, rank, score, snapshot_date, period_start)
  SELECT department_code, 'department', 'revit', rank::smallint, contest_score, v_today, v_period_start
  FROM view_top_dept_revit WHERE rank <= v_top_group
  ON CONFLICT (entity_id, entity_type, area, snapshot_date) DO NOTHING;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_snap_count := v_snap_count + v_tmp;

  -- WORKSECTION — без изменений (баг там тоже есть, но не в этом фиксе — см. задачу отдельно)
  INSERT INTO ach_ranking_snapshots (entity_id, entity_type, area, rank, score, snapshot_date, period_start)
  SELECT user_id::text, 'user', 'ws', rank::smallint, total_coins, v_today, v_period_start
  FROM view_top_pers_ws WHERE rank <= v_top_personal
  ON CONFLICT (entity_id, entity_type, area, snapshot_date) DO NOTHING;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_snap_count := v_snap_count + v_tmp;

  INSERT INTO ach_ranking_snapshots (entity_id, entity_type, area, rank, score, snapshot_date, period_start)
  SELECT team, 'team', 'ws', rank::smallint, contest_score, v_today, v_period_start
  FROM view_top_team_ws WHERE rank <= v_top_group
  ON CONFLICT (entity_id, entity_type, area, snapshot_date) DO NOTHING;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_snap_count := v_snap_count + v_tmp;

  INSERT INTO ach_ranking_snapshots (entity_id, entity_type, area, rank, score, snapshot_date, period_start)
  SELECT department_code, 'department', 'ws', rank::smallint, contest_score, v_today, v_period_start
  FROM view_top_dept_ws WHERE rank <= v_top_group
  ON CONFLICT (entity_id, entity_type, area, snapshot_date) DO NOTHING;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_snap_count := v_snap_count + v_tmp;

  FOR v_rec IN
    SELECT s.entity_id, s.entity_type, s.area, COUNT(*) AS days_in_top,
      COALESCE((SELECT threshold FROM ach_ranking_settings rs WHERE rs.area = s.area AND rs.entity_type = s.entity_type AND rs.is_active = true), 10) AS threshold
    FROM ach_ranking_snapshots s
    WHERE s.period_start = v_period_start
      AND s.rank <= CASE s.entity_type WHEN 'user' THEN v_top_personal ELSE v_top_group END
    GROUP BY s.entity_id, s.entity_type, s.area
    HAVING COUNT(*) >= COALESCE((SELECT threshold FROM ach_ranking_settings rs WHERE rs.area = s.area AND rs.entity_type = s.entity_type AND rs.is_active = true), 10)
  LOOP
    IF EXISTS (
      SELECT 1 FROM ach_awards WHERE entity_id = v_rec.entity_id
        AND entity_type = v_rec.entity_type AND area = v_rec.area AND period_start = v_period_start
    ) THEN CONTINUE; END IF;

    SELECT coins INTO v_bonus FROM gamification_event_types
    WHERE key = CASE v_rec.entity_type
      WHEN 'user' THEN 'ach_personal' WHEN 'team' THEN 'ach_team' WHEN 'department' THEN 'ach_department'
    END AND is_active = true;

    IF v_bonus IS NULL THEN CONTINUE; END IF;

    IF v_rec.entity_type = 'user' THEN
      INSERT INTO gamification_event_logs (user_id, user_email, event_type, source, event_date, details, idempotency_key)
      SELECT wu.id, wu.email, 'ach_personal', 'achievements', v_today,
        jsonb_build_object('area', v_rec.area, 'days_in_top', v_rec.days_in_top, 'period_start', v_period_start),
        'ach_user_' || v_rec.area || '_' || v_rec.entity_id || '_' || v_period_start
      FROM ws_users wu WHERE wu.id = v_rec.entity_id::uuid
      ON CONFLICT (idempotency_key) DO NOTHING RETURNING id INTO v_event_id;

      IF v_event_id IS NOT NULL THEN
        INSERT INTO gamification_transactions (user_id, user_email, event_id, coins)
        SELECT wu.id, wu.email, v_event_id, v_bonus FROM ws_users wu WHERE wu.id = v_rec.entity_id::uuid;
        INSERT INTO gamification_balances (user_id, total_coins, updated_at) VALUES (v_rec.entity_id::uuid, v_bonus, now())
        ON CONFLICT (user_id) DO UPDATE SET total_coins = gamification_balances.total_coins + v_bonus, updated_at = now();
        v_awarded_count := v_awarded_count + 1;
      END IF;

    ELSIF v_rec.entity_type = 'team' THEN
      FOR v_emp IN SELECT id, email FROM ws_users WHERE team = v_rec.entity_id AND is_active = true AND team != 'Декретный' LOOP
        INSERT INTO gamification_event_logs (user_id, user_email, event_type, source, event_date, details, idempotency_key)
        VALUES (v_emp.id, v_emp.email, 'ach_team', 'achievements', v_today,
          jsonb_build_object('area', v_rec.area, 'team', v_rec.entity_id, 'days_in_top', v_rec.days_in_top, 'period_start', v_period_start),
          'ach_team_' || v_rec.area || '_' || v_emp.id || '_' || v_period_start)
        ON CONFLICT (idempotency_key) DO NOTHING RETURNING id INTO v_event_id;
        IF FOUND AND v_event_id IS NOT NULL THEN
          INSERT INTO gamification_transactions (user_id, user_email, event_id, coins) VALUES (v_emp.id, v_emp.email, v_event_id, v_bonus);
          INSERT INTO gamification_balances (user_id, total_coins, updated_at) VALUES (v_emp.id, v_bonus, now())
          ON CONFLICT (user_id) DO UPDATE SET total_coins = gamification_balances.total_coins + v_bonus, updated_at = now();
        END IF;
      END LOOP;
      v_awarded_count := v_awarded_count + 1;

    ELSIF v_rec.entity_type = 'department' THEN
      FOR v_emp IN SELECT id, email FROM ws_users WHERE department_code = v_rec.entity_id AND is_active = true AND team IS DISTINCT FROM 'Декретный' LOOP
        INSERT INTO gamification_event_logs (user_id, user_email, event_type, source, event_date, details, idempotency_key)
        VALUES (v_emp.id, v_emp.email, 'ach_department', 'achievements', v_today,
          jsonb_build_object('area', v_rec.area, 'department', v_rec.entity_id, 'days_in_top', v_rec.days_in_top, 'period_start', v_period_start),
          'ach_dept_' || v_rec.area || '_' || v_emp.id || '_' || v_period_start)
        ON CONFLICT (idempotency_key) DO NOTHING RETURNING id INTO v_event_id;
        IF FOUND AND v_event_id IS NOT NULL THEN
          INSERT INTO gamification_transactions (user_id, user_email, event_id, coins) VALUES (v_emp.id, v_emp.email, v_event_id, v_bonus);
          INSERT INTO gamification_balances (user_id, total_coins, updated_at) VALUES (v_emp.id, v_bonus, now())
          ON CONFLICT (user_id) DO UPDATE SET total_coins = gamification_balances.total_coins + v_bonus, updated_at = now();
        END IF;
      END LOOP;
      v_awarded_count := v_awarded_count + 1;
    END IF;

    INSERT INTO ach_awards (entity_id, entity_type, area, period_start, days_in_top)
    VALUES (v_rec.entity_id, v_rec.entity_type, v_rec.area, v_period_start, v_rec.days_in_top)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object('date', v_today, 'period_start', v_period_start,
    'period_end', fn_ach_period_end(v_today), 'snapshots_inserted', v_snap_count, 'awards_given', v_awarded_count);
END;
$function$;

-- 2. fn_ach_get_progress() — добавлено current_rank_launches в personal-блок (только revit).
--    Команды/отделы/благодарности — без изменений.
CREATE OR REPLACE FUNCTION public.fn_ach_get_progress(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ref_date date := fn_minsk_today() - 1;
  v_ps date; v_pe date; v_team text; v_dept text;
  v_personal jsonb; v_tp jsonb; v_dp jsonb; v_awards jsonb;
BEGIN
  v_ps := fn_ach_period_start(v_ref_date);
  v_pe := fn_ach_period_end(v_ref_date);
  SELECT team, department_code INTO v_team, v_dept FROM ws_users WHERE id = p_user_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'area', sub.area, 'days_in_top', sub.days, 'threshold', sub.threshold,
    'current_rank', sub.cr, 'earned', sub.days >= sub.threshold,
    'current_rank_launches', sub.crl
  )), '[]'::jsonb) INTO v_personal
  FROM (
    SELECT s.area, COUNT(*) AS days,
      COALESCE((SELECT threshold FROM ach_ranking_settings WHERE area = s.area AND entity_type = 'user'), 10) AS threshold,
      (SELECT rank FROM ach_ranking_snapshots WHERE entity_id = p_user_id::text AND entity_type = 'user' AND area = s.area AND period_start = v_ps ORDER BY snapshot_date DESC LIMIT 1) AS cr,
      CASE WHEN s.area = 'revit' THEN
        (SELECT rnk FROM fn_revit_launches_rank(v_ref_date) WHERE user_id = p_user_id)
      ELSE NULL END AS crl
    FROM ach_ranking_snapshots s WHERE s.entity_id = p_user_id::text AND s.entity_type = 'user' AND s.period_start = v_ps GROUP BY s.area
  ) sub;

  IF v_team IS NOT NULL AND v_team != '' AND v_team NOT LIKE 'Вне команд%' AND v_team != 'Декретный' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'area', sub.area, 'days_in_top', sub.days, 'threshold', sub.threshold,
      'team', v_team, 'current_rank', sub.cr, 'earned', sub.days >= sub.threshold
    )), '[]'::jsonb) INTO v_tp
    FROM (
      SELECT s.area, COUNT(*) AS days,
        COALESCE((SELECT threshold FROM ach_ranking_settings WHERE area = s.area AND entity_type = 'team'), 10) AS threshold,
        (SELECT rank FROM ach_ranking_snapshots WHERE entity_id = v_team AND entity_type = 'team' AND area = s.area AND period_start = v_ps ORDER BY snapshot_date DESC LIMIT 1) AS cr
      FROM ach_ranking_snapshots s WHERE s.entity_id = v_team AND s.entity_type = 'team' AND s.period_start = v_ps GROUP BY s.area
    ) sub;
  ELSE v_tp := '[]'::jsonb; END IF;

  IF v_dept IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'area', sub.area, 'days_in_top', sub.days, 'threshold', sub.threshold,
      'department', v_dept, 'current_rank', sub.cr, 'earned', sub.days >= sub.threshold
    )), '[]'::jsonb) INTO v_dp
    FROM (
      SELECT s.area, COUNT(*) AS days,
        COALESCE((SELECT threshold FROM ach_ranking_settings WHERE area = s.area AND entity_type = 'department'), 10) AS threshold,
        (SELECT rank FROM ach_ranking_snapshots WHERE entity_id = v_dept AND entity_type = 'department' AND area = s.area AND period_start = v_ps ORDER BY snapshot_date DESC LIMIT 1) AS cr
      FROM ach_ranking_snapshots s WHERE s.entity_id = v_dept AND s.entity_type = 'department' AND s.period_start = v_ps GROUP BY s.area
    ) sub;
  ELSE v_dp := '[]'::jsonb; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'entity_type', a.entity_type, 'area', a.area, 'period_start', a.period_start,
    'days_in_top', a.days_in_top, 'awarded_at', a.awarded_at, 'score', a.score
  ) ORDER BY a.awarded_at DESC), '[]'::jsonb) INTO v_awards
  FROM ach_awards a
  WHERE (a.entity_id = p_user_id::text AND a.entity_type = 'user')
     OR (a.entity_id = v_team AND a.entity_type = 'team')
     OR (a.entity_id = v_dept AND a.entity_type = 'department');

  RETURN jsonb_build_object(
    'period_start', v_ps, 'period_end', v_pe,
    'team', v_team, 'department', v_dept,
    'personal', v_personal, 'team_progress', v_tp,
    'department_progress', v_dp, 'awards', v_awards
  );
END;
$function$;

-- 3. Сам "флип" — вот этот UPDATE реально меняет поведение приложения.
--    Параметры финальные (сверить перед запуском!): 20 дней, топ-10 по запускам.
UPDATE public.ach_ranking_settings
SET threshold = 20,
    secondary_rank_limit = 10
WHERE area = 'revit' AND entity_type = 'user';

-- 4. Ручная проверка сразу после применения — дёрнуть функцию вручную,
--    не дожидаясь ночного крона, и посмотреть результат:
-- SELECT fn_ach_snapshot_rankings();
