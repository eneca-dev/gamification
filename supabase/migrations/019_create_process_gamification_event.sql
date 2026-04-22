-- Атомарная функция для VPS-скрипта compute-gamification.
-- Заменяет 3 отдельных вызова (INSERT event + INSERT transaction + RPC increment_balance)
-- одной транзакцией — устраняет риск осиротевших записей при crash.
--
-- Возвращает:
--   event_id — ID созданного события (NULL если дубль по idempotency_key)
--   skipped  — true если событие уже существовало (дубль)

CREATE OR REPLACE FUNCTION process_gamification_event(
  p_user_id        uuid,
  p_user_email     text,
  p_event_type     text,
  p_source         text,
  p_event_date     date,
  p_details        jsonb,
  p_idempotency_key text,
  p_coins          integer
)
RETURNS TABLE(event_id uuid, skipped boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  -- 1. INSERT событие (дубль по idempotency_key → пропуск)
  INSERT INTO gamification_event_logs (
    user_id, user_email, event_type, source, event_date, details, idempotency_key
  )
  VALUES (
    p_user_id, p_user_email, p_event_type, p_source, p_event_date, p_details, p_idempotency_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_event_id;

  -- Дубль — выходим, ничего не создаём
  IF v_event_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, true;
    RETURN;
  END IF;

  -- 2. INSERT транзакция (только если есть 💎)
  IF p_coins <> 0 THEN
    INSERT INTO gamification_transactions (user_id, user_email, event_id, coins)
    VALUES (p_user_id, p_user_email, v_event_id, p_coins);

    -- 3. UPDATE баланс (атомарный UPSERT)
    INSERT INTO gamification_balances (user_id, total_coins, updated_at)
    VALUES (p_user_id, p_coins, now())
    ON CONFLICT (user_id) DO UPDATE
      SET total_coins = gamification_balances.total_coins + p_coins,
          updated_at  = now();
  END IF;

  RETURN QUERY SELECT v_event_id, false;
END;
$$;

-- RLS не применяется к SECURITY DEFINER функциям,
-- но доступ ограничен: только service_role может вызвать через Supabase client
REVOKE ALL ON FUNCTION process_gamification_event FROM PUBLIC;
GRANT EXECUTE ON FUNCTION process_gamification_event TO service_role;
