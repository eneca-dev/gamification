-- A manually added green day can have a different idempotency key. During
-- replay, award the ordinary green-day amount only if no such event exists.
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
    IF NOT EXISTS (
      SELECT 1 FROM public.gamification_event_logs g
      WHERE g.user_id = p_user_id AND g.source = 'ws'
        AND g.event_type = 'green_day' AND g.ranking_date = p_event_date
    ) THEN
      PERFORM public.process_gamification_event(
        p_user_id, v_email, 'green_day', 'ws', p_event_date, '{}'::jsonb,
        'ws_green_day_' || p_user_id || '_' || p_event_date,
        v_base_coins, false);
    END IF;
  ELSE
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
