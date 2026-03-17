-- Исправление крон-джоба: старый URL sync-plugin → sync-plugin-launches
-- Функция была переименована в репозитории, но cron.job не обновился.
-- Из-за этого elk_plugin_launches не обновлялась с 11 марта.

SELECT cron.unschedule('sync-plugin-launches-daily');

SELECT cron.schedule(
  'sync-plugin-launches-daily',
  '0 1 * * *',
  $$
  select net.http_post(
    url := 'https://yqezhfughtublpaitmij.supabase.co/functions/v1/sync-plugin-launches',
    headers := '{"Authorization": "Bearer secret"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);
