-- Ежедневный «догон» milestone-бонусов за стрик (7/30/90), работающий КАЖДЫЙ день,
-- включая выходные/праздники. Вызывается шагом оркестратора catch-up-streak-milestones
-- после обоих compute-* и до compute-achievements.
--
-- Зачем: compute-gamification пропускает выходные (green/red дни не считаются — это
-- правильно), а compute-revit гейтит начисление по isWorkingDay. Из-за этого
-- milestone-бонусы, пороги которых пересечены в Сб/Вс (выходной = +1 к стрику),
-- не выдаются до следующего рабочего дня. Эта функция читает effective-стрики и
-- идемпотентно доначисляет недостающее + сбрасывает завершённые циклы (Revit 30, WS 90).
--
-- Идемпотентность: условие «стрик достиг T И в этом цикле бонуса ещё не было»
-- (event_date >= streak_start_date) + идемпотентные ключи. В будни, где основной
-- compute уже выдал бонус, функция ничего не делает.
--
-- Начисление — через process_gamification_event (та же функция, что у ночных
-- скриптов): событие + транзакция + баланс атомарно, с настоящими типами событий.

CREATE OR REPLACE FUNCTION public.fn_catch_up_streak_milestones()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_yesterday date := fn_minsk_today() - 1;
  v_awarded int := 0;
  v_reset int := 0;
  r record;
  v_cycles int;
BEGIN
  -- ===== WS 7 и 30 (награда, без сброса; цикл WS = 90) =====
  FOR r IN
    SELECT e.user_id, wu.email, e.current_streak, e.streak_start_date
    FROM ws_user_streaks_effective e
    JOIN ws_users wu ON wu.id = e.user_id AND wu.is_active = true
    WHERE e.streak_start_date IS NOT NULL AND e.current_streak >= 7
  LOOP
    IF r.current_streak >= 7 AND NOT EXISTS (
      SELECT 1 FROM gamification_event_logs g
      WHERE g.user_id = r.user_id AND g.event_type = 'ws_streak_7' AND g.event_date >= r.streak_start_date
    ) THEN
      PERFORM process_gamification_event(r.user_id, r.email, 'ws_streak_7', 'ws', v_yesterday, '{}'::jsonb,
        'ws_streak_7_' || r.user_id || '_' || v_yesterday,
        (SELECT coins FROM gamification_event_types WHERE key = 'ws_streak_7' AND is_active), true);
      v_awarded := v_awarded + 1;
    END IF;

    IF r.current_streak >= 30 AND NOT EXISTS (
      SELECT 1 FROM gamification_event_logs g
      WHERE g.user_id = r.user_id AND g.event_type = 'ws_streak_30' AND g.event_date >= r.streak_start_date
    ) THEN
      PERFORM process_gamification_event(r.user_id, r.email, 'ws_streak_30', 'ws', v_yesterday, '{}'::jsonb,
        'ws_streak_30_' || r.user_id || '_' || v_yesterday,
        (SELECT coins FROM gamification_event_types WHERE key = 'ws_streak_30' AND is_active), true);
      v_awarded := v_awarded + 1;
    END IF;
  END LOOP;

  -- ===== WS 90 (награда + сброс цикла), кроме pending =====
  FOR r IN
    SELECT e.user_id, wu.email, e.current_streak, e.streak_start_date
    FROM ws_user_streaks_effective e
    JOIN ws_users wu ON wu.id = e.user_id AND wu.is_active = true
    WHERE e.streak_start_date IS NOT NULL AND e.current_streak >= 90
      AND (SELECT pending_reset_date FROM ws_user_streaks s WHERE s.user_id = e.user_id) IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM gamification_event_logs g
        WHERE g.user_id = e.user_id AND g.event_type = 'ws_streak_90' AND g.event_date >= e.streak_start_date)
  LOOP
    SELECT completed_cycles INTO v_cycles FROM ws_user_streaks WHERE user_id = r.user_id;
    PERFORM process_gamification_event(r.user_id, r.email, 'ws_streak_90', 'ws', v_yesterday,
      jsonb_build_object('completed_cycles', v_cycles + 1),
      'ws_streak_90_' || r.user_id || '_' || v_yesterday,
      (SELECT coins FROM gamification_event_types WHERE key = 'ws_streak_90' AND is_active), true);
    UPDATE ws_user_streaks
      SET current_streak = 0, streak_start_date = NULL, completed_cycles = completed_cycles + 1,
          pending_reset_date = NULL, pending_reset_expires_at = NULL
      WHERE user_id = r.user_id;
    v_awarded := v_awarded + 1;
    v_reset := v_reset + 1;
  END LOOP;

  -- ===== Revit 7 (награда). ВАЖНО: до Revit-30, иначе сброс обнулит streak_start_date =====
  FOR r IN
    SELECT e.user_id, wu.email, e.current_streak, e.streak_start_date
    FROM revit_user_streaks_effective e
    JOIN ws_users wu ON wu.id = e.user_id AND wu.is_active = true
    WHERE e.streak_start_date IS NOT NULL AND e.current_streak >= 7
      AND NOT EXISTS (
        SELECT 1 FROM gamification_event_logs g
        WHERE g.user_id = e.user_id AND g.event_type = 'revit_streak_7_bonus' AND g.event_date >= e.streak_start_date)
  LOOP
    PERFORM process_gamification_event(r.user_id, r.email, 'revit_streak_7_bonus', 'revit', v_yesterday, '{}'::jsonb,
      'revit_streak_7_' || r.user_id || '_' || v_yesterday,
      (SELECT coins FROM gamification_event_types WHERE key = 'revit_streak_7_bonus' AND is_active), true);
    v_awarded := v_awarded + 1;
  END LOOP;

  -- ===== Revit 30 (награда + сброс цикла; цикл Revit = 30), кроме pending =====
  FOR r IN
    SELECT e.user_id, wu.email, e.current_streak, e.streak_start_date
    FROM revit_user_streaks_effective e
    JOIN ws_users wu ON wu.id = e.user_id AND wu.is_active = true
    WHERE e.streak_start_date IS NOT NULL AND e.current_streak >= 30
      AND (SELECT pending_reset_date FROM revit_user_streaks s WHERE s.user_id = e.user_id) IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM gamification_event_logs g
        WHERE g.user_id = e.user_id AND g.event_type = 'revit_streak_30_bonus' AND g.event_date >= e.streak_start_date)
  LOOP
    SELECT completed_cycles INTO v_cycles FROM revit_user_streaks WHERE user_id = r.user_id;
    PERFORM process_gamification_event(r.user_id, r.email, 'revit_streak_30_bonus', 'revit', v_yesterday,
      jsonb_build_object('completed_cycles', v_cycles + 1),
      'revit_streak_30_' || r.user_id || '_' || v_yesterday,
      (SELECT coins FROM gamification_event_types WHERE key = 'revit_streak_30_bonus' AND is_active), true);
    UPDATE revit_user_streaks
      SET current_streak = 0, streak_start_date = NULL, completed_cycles = completed_cycles + 1,
          pending_reset_date = NULL, pending_reset_expires_at = NULL
      WHERE user_id = r.user_id;
    v_awarded := v_awarded + 1;
    v_reset := v_reset + 1;
  END LOOP;

  RETURN jsonb_build_object('yesterday', v_yesterday, 'awarded', v_awarded, 'streaks_reset', v_reset);
END
$function$;
