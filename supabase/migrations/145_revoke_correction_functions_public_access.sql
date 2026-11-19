-- Функции корректировок меняют балансы, транзакции и стрики, а внутри не проверяют права:
-- в боевой БД они были доступны anon и authenticated (REVOKE ... FROM PUBLIC из миграции 133
-- не снимает прямые гранты Supabase). Приложение вызывает их только через service_role.
REVOKE ALL ON FUNCTION public.fn_correction_add_transaction(uuid, text, date, integer, jsonb, text, boolean, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_correction_delete_transaction(uuid, text, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_correction_fix_revit_day(uuid, date[], text, text, text, boolean, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_correction_fix_revit_day(uuid, date[], text, text, text, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_correction_fix_ws_day(uuid, date[], text, text, text, boolean, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_correction_fix_ws_day(uuid, date[], text, text, text, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_correction_remove_event(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_correction_remove_shield(uuid, date, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_correction_set_day_status(uuid, date, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_storage_used_bytes()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_correction_add_transaction(uuid, text, date, integer, jsonb, text, boolean, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_correction_delete_transaction(uuid, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_correction_fix_revit_day(uuid, date[], text, text, text, boolean, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_correction_fix_revit_day(uuid, date[], text, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_correction_fix_ws_day(uuid, date[], text, text, text, boolean, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_correction_fix_ws_day(uuid, date[], text, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_correction_remove_event(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_correction_remove_shield(uuid, date, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_correction_set_day_status(uuid, date, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_storage_used_bytes() TO service_role;
