-- Variable daily supplement for active Worksection and Revit streaks.
-- Installed off: no historical rewards are created by this migration.
INSERT INTO public.gamification_event_types
  (key, name, coins, is_dynamic_coins, is_active, description)
VALUES
  ('streak_daily_bonus', 'Доплата за длинную серию', 0, true, false,
   'За подходящий день после каждой полной недели серии: +1 кристалл за каждую завершённую неделю')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE public.streak_bonus_periods (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  starts_on date NOT NULL,
  ends_before date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT streak_bonus_period_valid CHECK (ends_before IS NULL OR ends_before > starts_on)
);
CREATE UNIQUE INDEX streak_bonus_period_one_open ON public.streak_bonus_periods ((true))
  WHERE ends_before IS NULL;
CREATE INDEX streak_bonus_period_dates ON public.streak_bonus_periods (starts_on, ends_before);
ALTER TABLE public.streak_bonus_periods ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.streak_bonus_periods FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.streak_bonus_periods TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.streak_bonus_periods_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.fn_set_streak_daily_bonus_enabled(p_enabled boolean)
RETURNS date
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_effective date := public.fn_minsk_today() + 1;
  v_active boolean;
  v_open public.streak_bonus_periods%ROWTYPE;
BEGIN
  IF p_enabled IS NULL THEN RAISE EXCEPTION 'enabled must be specified'; END IF;
  SELECT is_active INTO v_active FROM public.gamification_event_types
    WHERE key = 'streak_daily_bonus' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'streak_daily_bonus event type is missing'; END IF;
  IF v_active = p_enabled THEN RETURN v_effective; END IF;

  SELECT * INTO v_open FROM public.streak_bonus_periods
    WHERE ends_before IS NULL FOR UPDATE;
  IF p_enabled THEN
    INSERT INTO public.streak_bonus_periods (starts_on) VALUES (v_effective);
  ELSIF v_open.id IS NOT NULL THEN
    IF v_open.starts_on >= v_effective THEN
      DELETE FROM public.streak_bonus_periods WHERE id = v_open.id;
    ELSE
      UPDATE public.streak_bonus_periods SET ends_before = v_effective WHERE id = v_open.id;
    END IF;
  END IF;
  UPDATE public.gamification_event_types
    SET is_active = p_enabled, updated_at = now()
    WHERE key = 'streak_daily_bonus';
  RETURN v_effective;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_award_streak_daily_bonus(
  p_user_id uuid, p_source text, p_event_date date, p_streak_day integer
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_base_coins integer;
  v_bonus integer;
BEGIN
  IF p_source IS NULL OR p_source NOT IN ('ws', 'revit') OR p_event_date IS NULL
     OR p_streak_day IS NULL
     OR p_streak_day < 8
     OR (p_source = 'ws' AND p_streak_day > 90)
     OR (p_source = 'revit' AND p_streak_day > 30)
     OR p_event_date >= public.fn_minsk_today() THEN
    RAISE EXCEPTION 'invalid daily streak bonus request';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.streak_bonus_periods p
    WHERE p.starts_on <= p_event_date
      AND (p.ends_before IS NULL OR p_event_date < p.ends_before)
  ) THEN RETURN false; END IF;

  SELECT lower(email) INTO v_email FROM public.ws_users
  WHERE id = p_user_id AND is_active = true;
  IF v_email IS NULL THEN RETURN false; END IF;

  IF p_source = 'ws' THEN
    IF NOT EXISTS (SELECT 1 FROM public.ws_daily_statuses d
                   WHERE d.user_id = p_user_id AND d.date = p_event_date AND d.status = 'green')
    THEN RETURN false; END IF;
    SELECT coins INTO v_base_coins FROM public.gamification_event_types
      WHERE key = 'green_day' AND is_active = true;
    IF v_base_coins IS NULL THEN RETURN false; END IF;
    -- Preserve the existing green-day key and date. A queued VPS event becomes
    -- an idempotent no-op after this call; base and supplement commit together.
    PERFORM public.process_gamification_event(
      p_user_id, v_email, 'green_day', 'ws', p_event_date, '{}'::jsonb,
      'ws_green_day_' || p_user_id || '_' || p_event_date,
      v_base_coins, false);
  ELSE
    -- The Revit trigger has already validated the launch and awarded the base.
    IF NOT EXISTS (SELECT 1 FROM public.gamification_event_logs g
                   WHERE g.user_id = p_user_id AND g.event_type = 'revit_using_plugins'
                     AND g.event_date = p_event_date)
    THEN RETURN false; END IF;
  END IF;

  v_bonus := (p_streak_day - 1) / 7;
  PERFORM public.process_gamification_event(
    p_user_id, v_email, 'streak_daily_bonus', p_source, p_event_date,
    jsonb_build_object('streak_day', p_streak_day, 'weekly_bonus', v_bonus, 'source', p_source),
    'streak_daily_bonus_' || p_source || '_' || p_user_id || '_' || p_event_date,
    v_bonus, true);
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.fn_award_streak_daily_bonus(uuid, text, date, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_award_streak_daily_bonus(uuid, text, date, integer)
  TO service_role;

-- Nightly recovery runs before milestone catch-up closes a 90/30-day cycle.
-- The normal compute scripts have usually awarded these already; unique keys
-- make this path a no-op on a healthy run.
CREATE OR REPLACE FUNCTION public.fn_catch_up_streak_daily_bonus()
RETURNS integer LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  v_day date := public.fn_minsk_today() - 1;
  v_count integer := 0;
  r record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.streak_bonus_periods p
                 WHERE p.starts_on <= v_day AND (p.ends_before IS NULL OR v_day < p.ends_before))
  THEN RETURN 0; END IF;

  FOR r IN
    SELECT e.user_id, e.current_streak AS streak_day
    FROM public.ws_user_streaks_effective e
    JOIN public.ws_daily_statuses d ON d.user_id = e.user_id
      AND d.date = v_day AND d.status = 'green'
    WHERE e.current_streak BETWEEN 8 AND 90
  LOOP
    IF public.fn_award_streak_daily_bonus(r.user_id, 'ws', v_day, r.streak_day) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  FOR r IN
    SELECT e.user_id, e.current_streak AS streak_day
    FROM public.revit_user_streaks_effective e
    JOIN public.gamification_event_logs g ON g.user_id = e.user_id
      AND g.event_type = 'revit_using_plugins' AND g.event_date = v_day
    WHERE e.current_streak BETWEEN 8 AND 30
  LOOP
    IF public.fn_award_streak_daily_bonus(r.user_id, 'revit', v_day, r.streak_day) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$function$;
REVOKE ALL ON FUNCTION public.fn_catch_up_streak_daily_bonus() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_catch_up_streak_daily_bonus() TO service_role;
REVOKE ALL ON FUNCTION public.fn_set_streak_daily_bonus_enabled(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_set_streak_daily_bonus_enabled(boolean) TO service_role;

-- The legacy trigger shifts WS event_date by one day. Its ranking_date must
-- keep the original work date for this new daily award.
CREATE OR REPLACE FUNCTION public.fn_fix_ws_event_date()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN
  IF NEW.source = 'ws' THEN
    NEW.ranking_date := CASE
      WHEN NEW.event_type IN (
        'green_day', 'red_day', 'task_dynamics_violation', 'section_red',
        'wrong_status_report', 'streak_reset_timetracking',
        'streak_reset_dynamics', 'streak_reset_section',
        'streak_reset_wrong_status', 'ws_streak_7', 'ws_streak_30',
        'ws_streak_90', 'streak_daily_bonus'
      ) THEN NEW.event_date
      ELSE (COALESCE(NEW.created_at, now()) AT TIME ZONE 'Europe/Minsk')::date
    END;
    NEW.event_date := NEW.event_date + 1;
  ELSE
    NEW.ranking_date := NEW.event_date;
  END IF;
  RETURN NEW;
END;
$function$;

-- Rebuild only the variable daily awards after an administrator changes a
-- historical day. The existing milestone replay remains the source of truth
-- for 7/30/90 rewards and cycle state.
CREATE OR REPLACE FUNCTION public.fn_reconcile_streak_daily_bonus(
  p_user_id uuid, p_source text
)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  v_email text;
  v_day date;
  v_yesterday date := public.fn_minsk_today() - 1;
  v_running integer := 0;
  v_cycle integer;
  v_coins integer;
  v_expected jsonb := '[]'::jsonb;
  v_actual record;
  v_expected_row record;
  v_removed jsonb;
BEGIN
  IF p_source NOT IN ('ws', 'revit') THEN RAISE EXCEPTION 'invalid source'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.streak_bonus_periods) THEN RETURN; END IF;
  SELECT lower(email) INTO v_email FROM public.ws_users WHERE id = p_user_id;
  IF v_email IS NULL THEN RAISE EXCEPTION 'unknown user'; END IF;
  v_cycle := CASE WHEN p_source = 'ws' THEN 90 ELSE 30 END;

  FOR v_day IN
    SELECT gs::date FROM generate_series('2026-07-01'::timestamp,
      v_yesterday::timestamp, interval '1 day') gs
  LOOP
    IF public.fn_streak_day_is_breaker(p_user_id, v_email, v_day, p_source) THEN
      v_running := 0;
      CONTINUE;
    END IF;
    IF public.fn_streak_day_delta(p_user_id, v_email, v_day, p_source) = 1 THEN
      v_running := v_running + 1;
      IF v_running >= 8 AND EXISTS (
        SELECT 1 FROM public.streak_bonus_periods p
        WHERE p.starts_on <= v_day AND (p.ends_before IS NULL OR v_day < p.ends_before)
      ) AND (
        (p_source = 'ws' AND EXISTS (
          SELECT 1 FROM public.ws_daily_statuses d
          WHERE d.user_id = p_user_id AND d.date = v_day AND d.status = 'green'))
        OR (p_source = 'revit' AND EXISTS (
          SELECT 1 FROM public.gamification_event_logs g
          WHERE g.user_id = p_user_id AND g.event_type = 'revit_using_plugins'
            AND g.event_date = v_day))
      ) THEN
        v_coins := (v_running - 1) / 7;
        v_expected := v_expected || jsonb_build_object(
          'date', v_day, 'streak_day', v_running, 'coins', v_coins);
      END IF;
      IF v_running = v_cycle THEN v_running := 0; END IF;
    END IF;
  END LOOP;

  FOR v_actual IN
    SELECT g.id, g.details, t.coins,
      CASE WHEN p_source = 'ws' THEN g.ranking_date ELSE g.event_date END AS work_date
    FROM public.gamification_event_logs g
    LEFT JOIN public.gamification_transactions t ON t.event_id = g.id
    WHERE g.user_id = p_user_id AND g.source = p_source
      AND g.event_type = 'streak_daily_bonus'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_expected) e
      WHERE (e->>'date')::date = v_actual.work_date
        AND (e->>'streak_day')::integer = (v_actual.details->>'streak_day')::integer
        AND (e->>'coins')::integer = v_actual.coins
    ) THEN
      v_removed := public.fn_correction_remove_event(v_actual.id);
      IF COALESCE((v_removed->>'ok')::boolean, false) = false THEN
        RAISE EXCEPTION 'could not remove stale streak daily bonus %', v_actual.id;
      END IF;
    END IF;
  END LOOP;

  FOR v_expected_row IN
    SELECT (e->>'date')::date AS work_date,
           (e->>'streak_day')::integer AS streak_day
    FROM jsonb_array_elements(v_expected) e
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.gamification_event_logs g
      WHERE g.user_id = p_user_id AND g.source = p_source
        AND g.event_type = 'streak_daily_bonus'
        AND CASE WHEN p_source = 'ws' THEN g.ranking_date ELSE g.event_date END = v_expected_row.work_date
    ) THEN
      PERFORM public.fn_award_streak_daily_bonus(
        p_user_id, p_source, v_expected_row.work_date, v_expected_row.streak_day);
    END IF;
  END LOOP;
END;
$function$;
REVOKE ALL ON FUNCTION public.fn_reconcile_streak_daily_bonus(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reconcile_streak_daily_bonus(uuid, text)
  TO service_role;

-- Keep the existing milestone replay intact; reconcile variable daily awards afterwards.
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

  PERFORM public.fn_reconcile_streak_daily_bonus(p_user_id, p_domain);

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


