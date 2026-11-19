-- The nightly RPC used to read each effective streak view twice and reached
-- PostgREST's 8s statement timeout. Keep the zero-argument RPC used by the VPS,
-- but calculate each domain once. The dated entry point is for controlled replay.
-- Only the service role may award coins through these SECURITY DEFINER functions.

CREATE OR REPLACE FUNCTION public.fn_catch_up_streak_milestones_for_date(p_award_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $function$
DECLARE
  v_awarded integer := 0;
  v_reset integer := 0;
  v_cycles integer;
  r record;
BEGIN
  IF p_award_date IS NULL OR p_award_date > public.fn_minsk_today() - 1 THEN
    RAISE EXCEPTION 'award date must be no later than yesterday';
  END IF;

  -- WS: award 7/30 before closing the 90-day cycle. Read the effective view once.
  FOR r IN
    SELECT e.user_id, u.email, e.current_streak, e.streak_start_date,
           s.pending_reset_date
    FROM public.ws_user_streaks_effective e
    JOIN public.ws_users u ON u.id = e.user_id AND u.is_active = true
    JOIN public.ws_user_streaks s ON s.user_id = e.user_id
    WHERE e.streak_start_date IS NOT NULL AND e.current_streak >= 7
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.gamification_event_logs g
      WHERE g.user_id = r.user_id AND g.event_type = 'ws_streak_7'
        AND g.event_date >= r.streak_start_date
    ) THEN
      PERFORM public.process_gamification_event(
        r.user_id, r.email, 'ws_streak_7', 'ws', p_award_date, '{}'::jsonb,
        'ws_streak_7_' || r.user_id || '_' || p_award_date,
        (SELECT coins FROM public.gamification_event_types WHERE key = 'ws_streak_7' AND is_active), true);
      v_awarded := v_awarded + 1;
    END IF;

    IF r.current_streak >= 30 AND NOT EXISTS (
      SELECT 1 FROM public.gamification_event_logs g
      WHERE g.user_id = r.user_id AND g.event_type = 'ws_streak_30'
        AND g.event_date >= r.streak_start_date
    ) THEN
      PERFORM public.process_gamification_event(
        r.user_id, r.email, 'ws_streak_30', 'ws', p_award_date, '{}'::jsonb,
        'ws_streak_30_' || r.user_id || '_' || p_award_date,
        (SELECT coins FROM public.gamification_event_types WHERE key = 'ws_streak_30' AND is_active), true);
      v_awarded := v_awarded + 1;
    END IF;

    IF r.current_streak >= 90 AND r.pending_reset_date IS NULL AND NOT EXISTS (
      SELECT 1 FROM public.gamification_event_logs g
      WHERE g.user_id = r.user_id AND g.event_type = 'ws_streak_90'
        AND g.event_date >= r.streak_start_date
    ) THEN
      SELECT completed_cycles INTO v_cycles
      FROM public.ws_user_streaks WHERE user_id = r.user_id;
      PERFORM public.process_gamification_event(
        r.user_id, r.email, 'ws_streak_90', 'ws', p_award_date,
        jsonb_build_object('completed_cycles', v_cycles + 1),
        'ws_streak_90_' || r.user_id || '_' || p_award_date,
        (SELECT coins FROM public.gamification_event_types WHERE key = 'ws_streak_90' AND is_active), true);
      UPDATE public.ws_user_streaks
      SET current_streak = 0, streak_start_date = NULL,
          completed_cycles = completed_cycles + 1,
          pending_reset_date = NULL, pending_reset_expires_at = NULL
      WHERE user_id = r.user_id;
      v_awarded := v_awarded + 1;
      v_reset := v_reset + 1;
    END IF;
  END LOOP;

  -- Revit: award 7 before closing the 30-day cycle. Read the view once.
  FOR r IN
    SELECT e.user_id, u.email, e.current_streak, e.streak_start_date,
           s.pending_reset_date
    FROM public.revit_user_streaks_effective e
    JOIN public.ws_users u ON u.id = e.user_id AND u.is_active = true
    JOIN public.revit_user_streaks s ON s.user_id = e.user_id
    WHERE e.streak_start_date IS NOT NULL AND e.current_streak >= 7
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.gamification_event_logs g
      WHERE g.user_id = r.user_id AND g.event_type = 'revit_streak_7_bonus'
        AND g.event_date >= r.streak_start_date
    ) THEN
      PERFORM public.process_gamification_event(
        r.user_id, r.email, 'revit_streak_7_bonus', 'revit', p_award_date, '{}'::jsonb,
        'revit_streak_7_' || r.user_id || '_' || p_award_date,
        (SELECT coins FROM public.gamification_event_types WHERE key = 'revit_streak_7_bonus' AND is_active), true);
      v_awarded := v_awarded + 1;
    END IF;

    IF r.current_streak >= 30 AND r.pending_reset_date IS NULL AND NOT EXISTS (
      SELECT 1 FROM public.gamification_event_logs g
      WHERE g.user_id = r.user_id AND g.event_type = 'revit_streak_30_bonus'
        AND g.event_date >= r.streak_start_date
    ) THEN
      SELECT completed_cycles INTO v_cycles
      FROM public.revit_user_streaks WHERE user_id = r.user_id;
      PERFORM public.process_gamification_event(
        r.user_id, r.email, 'revit_streak_30_bonus', 'revit', p_award_date,
        jsonb_build_object('completed_cycles', v_cycles + 1),
        'revit_streak_30_' || r.user_id || '_' || p_award_date,
        (SELECT coins FROM public.gamification_event_types WHERE key = 'revit_streak_30_bonus' AND is_active), true);
      UPDATE public.revit_user_streaks
      SET current_streak = 0, streak_start_date = NULL,
          completed_cycles = completed_cycles + 1,
          pending_reset_date = NULL, pending_reset_expires_at = NULL
      WHERE user_id = r.user_id;
      v_awarded := v_awarded + 1;
      v_reset := v_reset + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'yesterday', p_award_date, 'awarded', v_awarded, 'streaks_reset', v_reset);
END
$function$;

CREATE OR REPLACE FUNCTION public.fn_catch_up_streak_milestones()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $function$
  SELECT public.fn_catch_up_streak_milestones_for_date(public.fn_minsk_today() - 1);
$function$;

REVOKE ALL ON FUNCTION public.fn_catch_up_streak_milestones() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_catch_up_streak_milestones_for_date(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_catch_up_streak_milestones() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_catch_up_streak_milestones_for_date(date) TO service_role;
