-- 055_byn_amount_trigger.sql
-- Auto-fill byn_amount on every INSERT into gamification_transactions.
-- byn_amount is a derived value: round(coins / current_crystal_rate(), 2).
-- If caller explicitly sets byn_amount, the trigger respects it (e.g. manual corrections).

CREATE OR REPLACE FUNCTION fn_set_byn_amount() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.byn_amount IS NULL THEN
    NEW.byn_amount := round(NEW.coins::numeric / current_crystal_rate(), 2);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_byn_amount ON gamification_transactions;
CREATE TRIGGER trg_set_byn_amount
  BEFORE INSERT ON gamification_transactions
  FOR EACH ROW EXECUTE FUNCTION fn_set_byn_amount();
