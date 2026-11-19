-- Бесплатные применения тоже имеют заказ, но не создают строку credits.
-- История применения является достаточным основанием запретить отмену.
CREATE OR REPLACE FUNCTION public.guard_streak_shield_order_cancel()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    IF EXISTS (SELECT 1 FROM public.streak_shield_log WHERE order_id = OLD.id) THEN
      RAISE EXCEPTION 'Применённую защиту нельзя вернуть';
    END IF;
    DELETE FROM public.streak_shield_credits
    WHERE order_id = OLD.id AND consumed_at IS NULL;
    IF EXISTS (SELECT 1 FROM public.streak_shield_credits WHERE order_id = OLD.id) THEN
      RAISE EXCEPTION 'Применённую защиту нельзя вернуть';
    END IF;
  END IF;
  RETURN NEW;
END $$;
