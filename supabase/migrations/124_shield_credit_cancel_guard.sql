-- Отмена заказа возвращает кристаллы. Неиспользованная защита исчезает,
-- а возврат уже применённой защиты блокируется в той же транзакции.
CREATE OR REPLACE FUNCTION public.guard_streak_shield_order_cancel()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_consumed_at timestamptz;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    SELECT consumed_at INTO v_consumed_at FROM public.streak_shield_credits
    WHERE order_id = OLD.id FOR UPDATE;
    IF FOUND THEN
      IF v_consumed_at IS NOT NULL THEN
        RAISE EXCEPTION 'Применённую защиту нельзя вернуть';
      END IF;
      DELETE FROM public.streak_shield_credits WHERE order_id = OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_streak_shield_order_cancel
  BEFORE UPDATE OF status ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_streak_shield_order_cancel();

REVOKE ALL ON FUNCTION public.guard_streak_shield_order_cancel() FROM PUBLIC, anon, authenticated;
