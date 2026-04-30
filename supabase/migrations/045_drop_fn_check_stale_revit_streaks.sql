-- Удаление fn_check_stale_revit_streaks.
--
-- Функция использовала revit_user_streaks.last_green_date для определения
-- «зомби-стриков» и проставления pending_reset_date. После миграции 040
-- триггер fn_award_revit_points больше не пишет last_green_date — поле
-- застывает, и функция стала ставить pending всем подряд.
--
-- Логику замещает phase 2 VPS-скрипта compute-revit-gamification: он
-- читает elk_plugin_launches за вчера и ставит pending только тем, у кого
-- launch'а действительно нет.

DROP FUNCTION IF EXISTS public.fn_check_stale_revit_streaks();
