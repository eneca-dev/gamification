-- Снятие pg_cron расписания Edge Function sync-plugin-launches.
--
-- Применяется после деплоя VPS-скрипта sync-plugin-launches.ts (Шаг 3+6 плана
-- src/docs-features/revit/streak-vps-migration.md). После этой миграции Edge Function
-- больше не вызывается автоматически. Сама функция остаётся живой ~1-2 недели
-- для экстренного ручного вызова, потом удаляется (Шаг 9 плана).
--
-- ПОРЯДОК применения:
--   1. Применить 040_revit_streak_view.sql.
--   2. Запустить бэкфилл streak_start_date.
--   3. Задеплоить VPS (sync-plugin-launches, compute-revit-gamification, compute-achievements).
--   4. Прогнать оркестратор руками, убедиться что Kibana-синк и ачивки работают.
--   5. Применить эту миграцию (042).
--   6. Применить 041_drop_fn_finalize_expired_revit_pendings.sql.

SELECT cron.unschedule('sync-plugin-launches-daily');
