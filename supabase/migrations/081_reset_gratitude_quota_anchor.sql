-- Сброс квоты на благодарности: новый якорь периода = 01.07.2026 (сегодня — первый день).
-- Период остаётся 14-дневным. CURRENT_DATE (UTC) заменён на fn_minsk_today() —
-- чтобы границы периода считались по минскому времени, как и вся остальная геймификация.
-- Менять нужно в двух местах синхронно: RPC get_sender_quota (UI) и триггер fn_award_gratitude_points_v2 (начисление).

CREATE OR REPLACE FUNCTION public.get_sender_quota(p_sender_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH period AS (
    SELECT (DATE '2026-07-01' + (
      FLOOR((fn_minsk_today() - DATE '2026-07-01')::int / 14)::int * 14
    ))::date AS period_start
  )
  SELECT jsonb_build_object(
    'used',
    EXISTS (
      SELECT 1 FROM gamification_event_logs
      WHERE event_type = 'gratitude_recipient_points'
        AND (details->>'sender_id')::uuid = p_sender_id
        AND (details->>'gift_source') IS NOT DISTINCT FROM 'quota'
        AND event_date >= (SELECT period_start FROM period)
        AND event_date < (SELECT period_start + 14 FROM period)
    ),
    'coins_per_gratitude',
    COALESCE(
      (SELECT coins FROM gamification_event_types
       WHERE key = 'gratitude_recipient_points' AND is_active),
      0
    ),
    'period_start',
    (SELECT period_start FROM period),
    'period_end',
    (SELECT period_start + 13 FROM period),
    'next_quota_date',
    CASE
      WHEN EXISTS (
        SELECT 1 FROM gamification_event_logs
        WHERE event_type = 'gratitude_recipient_points'
          AND (details->>'sender_id')::uuid = p_sender_id
          AND (details->>'gift_source') IS NOT DISTINCT FROM 'quota'
          AND event_date >= (SELECT period_start FROM period)
          AND event_date < (SELECT period_start + 14 FROM period)
      ) THEN (SELECT period_start + 14 FROM period)
      ELSE NULL
    END
  );
$function$;

CREATE OR REPLACE FUNCTION public.fn_award_gratitude_points_v2()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pts          INTEGER;
  v_event_id     UUID;
  v_sender_email TEXT;
  v_rcpt_email   TEXT;
  v_period_start DATE;
  v_already      INTEGER;
BEGIN
  IF NEW.type = 'thanks' THEN
    RETURN NEW;
  END IF;

  SELECT email INTO v_sender_email FROM ws_users WHERE id = NEW.sender_id;
  SELECT email INTO v_rcpt_email   FROM ws_users WHERE id = NEW.recipient_id;

  -- === ПОДАРОК ПО КВОТЕ ===
  IF NEW.gift_source = 'quota' THEN
    v_period_start := DATE '2026-07-01' + (
      FLOOR((fn_minsk_today() - DATE '2026-07-01')::int / 14)::int * 14
    );

    SELECT COUNT(*) INTO v_already
    FROM gamification_event_logs
    WHERE event_type = 'gratitude_recipient_points'
      AND (details->>'sender_id')::uuid = NEW.sender_id
      AND (details->>'gift_source') IS NOT DISTINCT FROM 'quota'
      AND event_date >= v_period_start
      AND event_date < v_period_start + 14;

    IF v_already > 0 THEN
      RETURN NEW;
    END IF;

    SELECT coins INTO v_pts
    FROM gamification_event_types
    WHERE key = 'gratitude_recipient_points' AND is_active;

    IF v_pts IS NULL THEN RETURN NEW; END IF;

    INSERT INTO gamification_event_logs
      (user_id, user_email, event_type, source, event_date, details, idempotency_key)
    VALUES (
      NEW.recipient_id, v_rcpt_email,
      'gratitude_recipient_points', 'gratitudes', NEW.created_at::date,
      jsonb_build_object(
        'gratitude_id', NEW.id, 'sender_id', NEW.sender_id,
        'sender_email', v_sender_email, 'category', NEW.category,
        'gift_source', 'quota'
      ),
      'gratitude_v2_' || NEW.id
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_event_id;

    IF FOUND THEN
      INSERT INTO gamification_transactions (user_id, user_email, event_id, coins)
      VALUES (NEW.recipient_id, v_rcpt_email, v_event_id, v_pts);

      INSERT INTO gamification_balances (user_id, total_coins, updated_at)
      VALUES (NEW.recipient_id, v_pts, now())
      ON CONFLICT (user_id) DO UPDATE
        SET total_coins = gamification_balances.total_coins + v_pts, updated_at = now();
    END IF;

  -- === ПОДАРОК ЗА СВОЙ СЧЁТ ===
  ELSIF NEW.gift_source = 'balance' THEN
    v_pts := COALESCE(NEW.coins_amount, 0);
    IF v_pts <= 0 THEN RETURN NEW; END IF;

    -- Атомарная проверка и списание у отправителя
    UPDATE gamification_balances
    SET total_coins = total_coins - v_pts, updated_at = now()
    WHERE user_id = NEW.sender_id AND total_coins >= v_pts;

    IF NOT FOUND THEN
      -- Недостаточно средств — не начисляем получателю
      RAISE EXCEPTION 'Insufficient balance for gift' USING ERRCODE = 'P0001';
    END IF;

    -- Лог списания у отправителя
    INSERT INTO gamification_event_logs
      (user_id, user_email, event_type, source, event_date, details, idempotency_key)
    VALUES (
      NEW.sender_id, v_sender_email,
      'gratitude_gift_sent', 'gratitudes', NEW.created_at::date,
      jsonb_build_object(
        'gratitude_id', NEW.id, 'recipient_id', NEW.recipient_id,
        'recipient_email', v_rcpt_email, 'category', NEW.category, 'coins', v_pts
      ),
      'gratitude_gift_sent_' || NEW.id
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_event_id;

    IF FOUND THEN
      INSERT INTO gamification_transactions (user_id, user_email, event_id, coins)
      VALUES (NEW.sender_id, v_sender_email, v_event_id, -v_pts);
    END IF;

    -- Начисление получателю
    INSERT INTO gamification_event_logs
      (user_id, user_email, event_type, source, event_date, details, idempotency_key)
    VALUES (
      NEW.recipient_id, v_rcpt_email,
      'gratitude_recipient_points', 'gratitudes', NEW.created_at::date,
      jsonb_build_object(
        'gratitude_id', NEW.id, 'sender_id', NEW.sender_id,
        'sender_email', v_sender_email, 'category', NEW.category,
        'gift_source', 'balance', 'coins', v_pts
      ),
      'gratitude_v2_' || NEW.id
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_event_id;

    IF FOUND THEN
      INSERT INTO gamification_transactions (user_id, user_email, event_id, coins)
      VALUES (NEW.recipient_id, v_rcpt_email, v_event_id, v_pts);

      INSERT INTO gamification_balances (user_id, total_coins, updated_at)
      VALUES (NEW.recipient_id, v_pts, now())
      ON CONFLICT (user_id) DO UPDATE
        SET total_coins = gamification_balances.total_coins + v_pts, updated_at = now();
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
