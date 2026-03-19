-- Функция: при создании profile ищет ws_user по email и проставляет user_id
CREATE OR REPLACE FUNCTION link_ws_user_on_profile_insert()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ws_users
  SET user_id = NEW.user_id
  WHERE lower(email) = lower(NEW.email)
    AND user_id IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Триггер на INSERT в profiles
CREATE TRIGGER trg_link_ws_user_on_profile_insert
AFTER INSERT ON profiles
FOR EACH ROW EXECUTE FUNCTION link_ws_user_on_profile_insert();
