-- 028_balance_clamp_at_zero.sql
-- Запрет отрицательного баланса: штраф списывает максимум до 0, остаток долга теряется.
--
-- 1. Новый event_type `balance_correction` — для разовой коррекции существующих минусов.
-- 2. Разовая коррекция: для каждого юзера с total_coins < 0 — компенсирующая транзакция,
--    балансы обнуляются, инвариант SUM(transactions) = balance сохраняется.
-- 3. process_gamification_event: при отрицательном p_coins не уводит баланс ниже 0,
--    в gamification_transactions пишется фактически применённая сумма.

-- 1. Новый event type для коррекции
INSERT INTO gamification_event_types (key, name, coins, description, is_active)
VALUES (
  'balance_correction',
  'Коррекция баланса',
  0,
  'Техническая коррекция баланса (не начисляется автоматически)',
  false
)
ON CONFLICT (key) DO NOTHING;

-- 2. Разовая коррекция существующих отрицательных балансов
DO $$
DECLARE
  r RECORD;
  v_event_id UUID;
  v_correction INTEGER;
BEGIN
  FOR r IN
    SELECT b.user_id, u.email, b.total_coins
    FROM gamification_balances b
    JOIN ws_users u ON u.id = b.user_id
    WHERE b.total_coins < 0
  LOOP
    v_correction := -r.total_coins;

    INSERT INTO gamification_event_logs (
      user_id, user_email, event_type, source, event_date, details, idempotency_key
    ) VALUES (
      r.user_id, r.email, 'balance_correction', 'system', CURRENT_DATE,
      jsonb_build_object('reason', 'clamp_negative_to_zero', 'migration', '028', 'original_balance', r.total_coins),
      'balance_correction_clamp_' || r.user_id::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_event_id;

    IF v_event_id IS NOT NULL THEN
      INSERT INTO gamification_transactions (user_id, user_email, event_id, coins)
      VALUES (r.user_id, r.email, v_event_id, v_correction);

      UPDATE gamification_balances
      SET total_coins = 0, updated_at = now()
      WHERE user_id = r.user_id;
    END IF;
  END LOOP;
END $$;

-- 3. Обновлённый process_gamification_event с clamp к нулю
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
  v_current_balance integer;
  v_applied_coins integer;
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

  -- Дубль — выходим
  IF v_event_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, true;
    RETURN;
  END IF;

  IF p_coins = 0 THEN
    RETURN QUERY SELECT v_event_id, false;
    RETURN;
  END IF;

  v_applied_coins := p_coins;

  -- 2. Clamp штрафа к доступному балансу (лок строки для защиты от race condition)
  IF p_coins < 0 THEN
    SELECT total_coins INTO v_current_balance
    FROM gamification_balances
    WHERE user_id = p_user_id
    FOR UPDATE;

    -- Баланса нет или 0 → списывать нечего, событие зафиксировано, но транзакция не создаётся
    IF v_current_balance IS NULL OR v_current_balance <= 0 THEN
      RETURN QUERY SELECT v_event_id, false;
      RETURN;
    END IF;

    -- Штраф не может превысить текущий баланс: было 10, штраф -50 → списываем -10
    IF v_current_balance + p_coins < 0 THEN
      v_applied_coins := -v_current_balance;
    END IF;
  END IF;

  -- 3. Транзакция с фактически применённой суммой
  INSERT INTO gamification_transactions (user_id, user_email, event_id, coins)
  VALUES (p_user_id, p_user_email, v_event_id, v_applied_coins);

  -- 4. UPSERT баланса
  INSERT INTO gamification_balances (user_id, total_coins, updated_at)
  VALUES (p_user_id, v_applied_coins, now())
  ON CONFLICT (user_id) DO UPDATE
    SET total_coins = gamification_balances.total_coins + v_applied_coins,
        updated_at  = now();

  RETURN QUERY SELECT v_event_id, false;
END;
$$;

REVOKE ALL ON FUNCTION process_gamification_event FROM PUBLIC;
GRANT EXECUTE ON FUNCTION process_gamification_event TO service_role;
