-- Удаление fn_finalize_expired_revit_pendings.
--
-- Применяется ПОСЛЕ декомиссии Edge Function sync-plugin-launches
-- (или удаления вызова RPC из её кода). До этого момента дроп ломает
-- ежедневный прогон Edge Function.
--
-- Финализацию просроченных pending теперь делает phase 1 VPS-скрипта
-- compute-revit-gamification (см. src/docs-features/revit/streak-vps-migration.md).

DROP FUNCTION IF EXISTS public.fn_finalize_expired_revit_pendings();
