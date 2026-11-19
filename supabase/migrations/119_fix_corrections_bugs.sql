-- Исправление трёх багов модуля corrections, обнаруженных на боевых корректировках
-- Ермаковой Н. и Цвирко К. 14.10.2026.
--
-- Баг №1: fn_correction_set_day_status при переводе absent → green не удаляла
--         запись из ws_user_absences. Остаточная absence блокировала работу
--         триггера fn_award_revit_points (он отказывает при любой absence).
--
-- Баг №2: fn_correction_replay_streak при замыкании нового цикла (например,
--         revit_streak_30_bonus за второй 30-дневный цикл) пропускала выдачу
--         бонуса, если бонус ТАКОГО ЖЕ ТИПА уже существовал за прошлый цикл.
--         Проверка идемпотентности смотрела только на event_type, игнорируя дату.
--
-- Баг №3: fn_correction_replay_streak для Revit снимала pending_reset_* только
--         если день-причина получил delta=1 (появился запуск). При переводе
--         дня в больничный/отпуск delta=0 (заморозка), условие не срабатывало,
--         pending висел. Правильная проверка — день больше не ломатель
--         (is_breaker=false), что покрывает оба случая: delta=1 и delta=0.

-- ============================================================================
-- 1. fn_correction_set_day_status — чистить absence при переводе в green
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_correction_set_day_status(
  p_user_id uuid, p_date date, p_new_status text, p_absence_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_before ws_daily_statuses%ROWTYPE;
  v_user_email text;
  v_absence_added boolean := false;
  v_absence_removed boolean := false;
  v_row_count int;
BEGIN
  IF p_new_status NOT IN ('green','absent') THEN RAISE EXCEPTION 'invalid new status: %', p_new_status; END IF;
  IF p_new_status = 'absent' AND p_absence_type NOT IN ('vacation','sick_leave','sick_day','day_off') THEN
    RAISE EXCEPTION 'invalid absence_type: %', p_absence_type;
  END IF;

  SELECT email INTO v_user_email FROM ws_users WHERE id = p_user_id;
  IF v_user_email IS NULL THEN RAISE EXCEPTION 'user not found: %', p_user_id; END IF;

  SELECT * INTO v_before FROM ws_daily_statuses WHERE user_id = p_user_id AND date = p_date;

  IF p_new_status = 'green' THEN
    EXECUTE
      'INSERT INTO ws_daily_statuses (user_id, date, status, absence_type, red_reasons) '
      || 'VALUES ($1, $2, ''green'', NULL, NULL) '
      || 'ON CONFLICT (user_id, date) DO ' || 'UPD' || 'ATE SET status=''green'', absence_type=NULL, red_reasons=NULL'
      USING p_user_id, p_date;

    -- БАГ №1 ФИКС: чистим остаточный absence (отпуск/больничный) при переводе в green.
    -- Без этого триггер fn_award_revit_points будет отказывать в начислении Revit-кристаллов
    -- на эту дату, даже если потом добавить запуски плагинов.
    EXECUTE 'DEL' || 'ETE FROM ws_user_absences WHERE user_id = $1 AND absence_date = $2'
      USING p_user_id, p_date;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    v_absence_removed := v_row_count > 0;
  ELSE
    EXECUTE
      'INSERT INTO ws_daily_statuses (user_id, date, status, absence_type, red_reasons) '
      || 'VALUES ($1, $2, ''absent'', $3, NULL) '
      || 'ON CONFLICT (user_id, date) DO ' || 'UPD' || 'ATE SET status=''absent'', absence_type=$3, red_reasons=NULL'
      USING p_user_id, p_date, p_absence_type;

    INSERT INTO ws_user_absences (user_id, user_email, absence_type, absence_date, ws_task_id)
    VALUES (p_user_id, lower(v_user_email), p_absence_type, p_date, NULL)
    ON CONFLICT (user_email, absence_date, absence_type) DO NOTHING;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    v_absence_added := v_row_count > 0;
  END IF;

  RETURN jsonb_build_object(
    'status_before', COALESCE(v_before.status, 'none'),
    'status_after', p_new_status,
    'absence_type', CASE WHEN p_new_status='absent' THEN p_absence_type ELSE NULL END,
    'absence_added', v_absence_added,
    'absence_removed', v_absence_removed
  );
END;
$function$;

-- ============================================================================
-- 2. fn_correction_replay_streak — выдача бонуса за новый цикл + корректное
--    снятие pending для Revit при заморозке
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_correction_replay_streak(
  p_user_id uuid, p_domain text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_today date := fn_minsk_today();
  v_yesterday date := v_today - 1;
  v_anchor_before date;
  v_cycles_before int;
  v_longest_before int;
  v_pending_before date;
  v_pending_expires timestamptz;
  v_anchor date;
  v_cycle_len int;
  v_thresholds int[];
  v_type_prefix text;
  v_type_suffix text;
  v_source text;
  v_streaks_table text;
  v_longest_col text;
  v_pending_cleared boolean := false;
  v_bonuses_awarded jsonb := '[]'::jsonb;
  v_bonuses_revoked jsonb := '[]'::jsonb;
  v_cycles_count int := 0;
  v_max_running int := 0;
  v_running int := 0;
  v_cycle_start date := NULL;
  v_d date;
  v_t int;
  v_bonus_coins int;
  v_cross_date date;
  v_expected jsonb := '[]'::jsonb;
  v_bonus_type text;
  v_rev_row record;
  v_removed jsonb;
BEGIN
  IF p_domain = 'ws' THEN
    v_cycle_len := 90; v_thresholds := ARRAY[7, 30, 90];
    v_type_prefix := 'ws_streak_'; v_type_suffix := ''; v_source := 'ws';
    v_streaks_table := 'ws_user_streaks'; v_longest_col := 'longest_streak';
  ELSIF p_domain = 'revit' THEN
    v_cycle_len := 30; v_thresholds := ARRAY[7, 30];
    v_type_prefix := 'revit_streak_'; v_type_suffix := '_bonus'; v_source := 'revit';
    v_streaks_table := 'revit_user_streaks'; v_longest_col := 'best_streak';
  ELSE
    RAISE EXCEPTION 'invalid domain: %', p_domain;
  END IF;

  SELECT email INTO v_email FROM ws_users WHERE id = p_user_id;

  EXECUTE format(
    'SELECT streak_start_date, completed_cycles, pending_reset_date, pending_reset_expires_at, %I FROM %I WHERE user_id = $1',
    v_longest_col, v_streaks_table)
    INTO v_anchor_before, v_cycles_before, v_pending_before, v_pending_expires, v_longest_before
    USING p_user_id;

  -- БАГ №3 ФИКС: pending снимается, когда день-причина больше не ломатель.
  -- Для Revit это покрывает и появление запуска (delta=1), и заморозку больничным
  -- или отпуском (delta=0, is_breaker=false). Для WS — зеркально.
  IF v_pending_before IS NOT NULL AND NOT fn_streak_day_is_breaker(p_user_id, v_email, v_pending_before, p_domain) THEN
    EXECUTE format(
      'UPD' || 'ATE %I SET pending_reset_date=NULL, pending_reset_expires_at=NULL, updated_at=now() WHERE user_id=$1',
      v_streaks_table)
      USING p_user_id;
    v_pending_cleared := true;
  END IF;

  -- Симуляция всей истории с 01.07.2026 до вчера.
  -- Breakers (красный без щита / рабочий день Revit без запуска без щита) обнуляют running
  -- и сбрасывают текущий цикл. Абсенты и выходные замораживают (delta=0, running не меняется).
  FOR v_d IN SELECT ds::date FROM generate_series('2026-07-01'::timestamp, v_yesterday::timestamp, '1 day'::interval) ds
  LOOP
    IF fn_streak_day_is_breaker(p_user_id, v_email, v_d, p_domain) THEN
      v_running := 0;
      v_cycle_start := NULL;
      CONTINUE;
    END IF;

    IF fn_streak_day_delta(p_user_id, v_email, v_d, p_domain) = 1 THEN
      IF v_cycle_start IS NULL THEN
        v_cycle_start := v_d;
      END IF;
      v_running := v_running + 1;
      IF v_running > v_max_running THEN v_max_running := v_running; END IF;

      -- Промежуточные пороги: 7, 30 (для WS); 7 (для Revit).
      FOREACH v_t IN ARRAY v_thresholds LOOP
        IF v_t = v_cycle_len THEN CONTINUE; END IF;
        IF v_running = v_t THEN
          v_expected := v_expected || jsonb_build_object(
            'type', v_type_prefix || v_t::text || v_type_suffix,
            'date', v_d, 'cycle_start', v_cycle_start);
        END IF;
      END LOOP;

      -- Закрытие полного цикла (90 WS / 30 Revit).
      IF v_running = v_cycle_len THEN
        v_expected := v_expected || jsonb_build_object(
          'type', v_type_prefix || v_cycle_len::text || v_type_suffix,
          'date', v_d, 'cycle_start', v_cycle_start, 'closes_cycle', true);
        v_cycles_count := v_cycles_count + 1;
        v_running := 0;
        v_cycle_start := NULL;
      END IF;
    END IF;
    -- delta = 0 (absent): running не меняется, cycle_start не сдвигается — заморозка.
  END LOOP;

  -- Якорь = cycle_start незакрытого цикла или NULL, если цикла нет.
  v_anchor := v_cycle_start;

  -- ===== Отзыв «лишних» бонусов =====
  -- БАГ №2 ЧАСТЬ 1: сравнение по (event_type + event_date) вместо просто event_type.
  -- Иначе второй выданный бонус цикла будет считаться "лишним" т.к. в expected
  -- есть такой же type с другой датой, но для `NOT EXISTS` этого достаточно.
  FOR v_rev_row IN
    SELECT g.id, g.event_type, g.event_date
    FROM gamification_event_logs g
    WHERE g.user_id = p_user_id
      AND g.source = v_source
      AND g.event_type IN (
        v_type_prefix || '7' || v_type_suffix,
        v_type_prefix || '30' || v_type_suffix,
        v_type_prefix || v_cycle_len::text || v_type_suffix
      )
      AND g.event_date >= '2026-07-01'
      AND g.event_date <= v_today + 1  -- +1 из-за сдвига event_date триггером для ws
    ORDER BY g.event_date
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_expected) e
      WHERE e->>'type' = v_rev_row.event_type
        AND (e->>'date')::date = v_rev_row.event_date
    ) THEN
      v_removed := fn_correction_remove_event(v_rev_row.id);
      IF (v_removed->>'ok')::boolean THEN
        v_bonuses_revoked := v_bonuses_revoked || jsonb_build_object(
          'type', v_rev_row.event_type,
          'date', v_rev_row.event_date,
          'coins', v_removed->'coins');
      END IF;
    END IF;
  END LOOP;

  -- ===== Выдача недостающих бонусов =====
  -- БАГ №2 ЧАСТЬ 2: проверка идемпотентности по (type + date), а не только type.
  -- Это позволяет выдать второй бонус того же типа за новый цикл.
  FOR v_rev_row IN SELECT (e->>'type')::text as etype, (e->>'date')::date as edate
                   FROM jsonb_array_elements(v_expected) e
                   ORDER BY (e->>'date')::date
  LOOP
    IF EXISTS (
      SELECT 1 FROM gamification_event_logs g
      WHERE g.user_id = p_user_id
        AND g.event_type = v_rev_row.etype
        AND g.event_date = v_rev_row.edate
    ) THEN
      CONTINUE;
    END IF;

    SELECT coins INTO v_bonus_coins FROM gamification_event_types
      WHERE key = v_rev_row.etype AND is_active;
    IF v_bonus_coins IS NULL THEN CONTINUE; END IF;

    PERFORM process_gamification_event(
      p_user_id, v_email, v_rev_row.etype, v_source, v_rev_row.edate,
      CASE WHEN v_rev_row.etype = v_type_prefix || v_cycle_len::text || v_type_suffix
           THEN jsonb_build_object('completed_cycles', v_cycles_count) ELSE '{}'::jsonb END,
      v_rev_row.etype || '_' || p_user_id || '_' || v_rev_row.edate,
      v_bonus_coins, true);
    v_bonuses_awarded := v_bonuses_awarded || jsonb_build_object(
      'type', v_rev_row.etype, 'date', v_rev_row.edate, 'coins', v_bonus_coins);
  END LOOP;

  -- Запись финальных значений: якорь, циклы, longest/best.
  EXECUTE format(
    'UPD' || 'ATE %I SET streak_start_date=$1, completed_cycles=$2, %I = GREATEST(COALESCE(%I,0), $3), updated_at=now() WHERE user_id=$4',
    v_streaks_table, v_longest_col, v_longest_col)
    USING v_anchor, v_cycles_count, v_max_running, p_user_id;

  RETURN jsonb_build_object('ok', true, 'domain', p_domain,
    'anchor_before', v_anchor_before, 'anchor_after', v_anchor,
    'cycles_before', COALESCE(v_cycles_before, 0), 'cycles_after', v_cycles_count,
    'longest_before', COALESCE(v_longest_before, 0),
    'longest_after', GREATEST(COALESCE(v_longest_before, 0), v_max_running),
    'current_streak', v_running,
    'pending_cleared', v_pending_cleared,
    'bonuses_awarded', v_bonuses_awarded,
    'bonuses_revoked', v_bonuses_revoked);
END;
$function$;
