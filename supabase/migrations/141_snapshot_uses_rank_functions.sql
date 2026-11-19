-- Ночной снапшот достижений переключается с матвью на расчёт по дате.
--
-- Было: функция читала view_top_*, у которых окно периода привязано к
-- fn_minsk_today(), и записывала результат с меткой fn_minsk_today() - 1.
-- Стало: тот же расчёт вызывается явно на дату снапшота — fn_rank_*(v_today),
-- см. миграцию 140.
--
-- Что это исправляет:
--   * обычный день — отложенные награды за задачи (ranking_date = день
--     начисления) больше не затекают во вчерашний итог;
--   * последний день месяца — окно считается от начала месяца v_today, а не
--     от начала месяца «сегодня», поэтому итог 31-го числа наконец содержит
--     весь месяц, а не первый день следующего.
--
-- REFRESH матвью сохранён: они обслуживают вкладку «Топы», и там окно
-- «на сегодня» корректно. Остальная логика функции — пороги, двойное условие
-- для revit/user, выдача наград, идемпотентность — не изменена.
--
-- Атрибуты сохранены как были: SECURITY DEFINER, search_path = public,
-- statement_timeout = 30s (миграция 130). Права (service_role) не меняются,
-- CREATE OR REPLACE их сохраняет.

CREATE OR REPLACE FUNCTION public.fn_ach_snapshot_rankings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout TO '30s'
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
  v_secondary_limit int;
BEGIN
  v_period_start := fn_ach_period_start(v_today);

  -- Матвью нужны вкладке «Топы» на главной: там актуален топ «на сегодня».
  -- Снапшот ниже их уже не читает.
  REFRESH MATERIALIZED VIEW CONCURRENTLY view_top_pers_revit;
  REFRESH MATERIALIZED VIEW CONCURRENTLY view_top_pers_ws;
  REFRESH MATERIALIZED VIEW CONCURRENTLY view_top_team_revit;
  REFRESH MATERIALIZED VIEW CONCURRENTLY view_top_team_ws;
  REFRESH MATERIALIZED VIEW CONCURRENTLY view_top_dept_revit;
  REFRESH MATERIALIZED VIEW CONCURRENTLY view_top_dept_ws;

  -- REVIT / user — двойное условие
  SELECT secondary_rank_limit INTO v_secondary_limit
  FROM ach_ranking_settings WHERE area = 'revit' AND entity_type = 'user' AND is_active = true;

  INSERT INTO ach_ranking_snapshots (entity_id, entity_type, area, rank, score, snapshot_date, period_start)
  SELECT p.user_id::text, 'user', 'revit', p.rank::smallint, p.total_coins, v_today, v_period_start
  FROM fn_rank_pers_revit(v_today) p
  WHERE p.rank <= v_top_personal
    AND (
      v_secondary_limit IS NULL
      OR EXISTS (
        SELECT 1 FROM fn_revit_launches_rank(v_today) l
        WHERE l.user_id = p.user_id AND l.rnk <= v_secondary_limit
      )
    )
  ON CONFLICT (entity_id, entity_type, area, snapshot_date) DO NOTHING;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_snap_count := v_snap_count + v_tmp;

  -- REVIT / team, department
  INSERT INTO ach_ranking_snapshots (entity_id, entity_type, area, rank, score, snapshot_date, period_start)
  SELECT team, 'team', 'revit', rank::smallint, contest_score, v_today, v_period_start
  FROM fn_rank_team_revit(v_today) WHERE rank <= v_top_group
  ON CONFLICT (entity_id, entity_type, area, snapshot_date) DO NOTHING;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_snap_count := v_snap_count + v_tmp;

  INSERT INTO ach_ranking_snapshots (entity_id, entity_type, area, rank, score, snapshot_date, period_start)
  SELECT department_code, 'department', 'revit', rank::smallint, contest_score, v_today, v_period_start
  FROM fn_rank_dept_revit(v_today) WHERE rank <= v_top_group
  ON CONFLICT (entity_id, entity_type, area, snapshot_date) DO NOTHING;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_snap_count := v_snap_count + v_tmp;

  -- WORKSECTION
  INSERT INTO ach_ranking_snapshots (entity_id, entity_type, area, rank, score, snapshot_date, period_start)
  SELECT user_id::text, 'user', 'ws', rank::smallint, total_coins, v_today, v_period_start
  FROM fn_rank_pers_ws(v_today) WHERE rank <= v_top_personal
  ON CONFLICT (entity_id, entity_type, area, snapshot_date) DO NOTHING;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_snap_count := v_snap_count + v_tmp;

  INSERT INTO ach_ranking_snapshots (entity_id, entity_type, area, rank, score, snapshot_date, period_start)
  SELECT team, 'team', 'ws', rank::smallint, contest_score, v_today, v_period_start
  FROM fn_rank_team_ws(v_today) WHERE rank <= v_top_group
  ON CONFLICT (entity_id, entity_type, area, snapshot_date) DO NOTHING;
  GET DIAGNOSTICS v_tmp = ROW_COUNT; v_snap_count := v_snap_count + v_tmp;

  INSERT INTO ach_ranking_snapshots (entity_id, entity_type, area, rank, score, snapshot_date, period_start)
  SELECT department_code, 'department', 'ws', rank::smallint, contest_score, v_today, v_period_start
  FROM fn_rank_dept_ws(v_today) WHERE rank <= v_top_group
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
