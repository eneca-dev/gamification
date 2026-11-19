-- Применять только после выкладки нового sync-ai-tender-usage на VPS:
-- старый скрипт ещё пишет в эти таблицы. Данные уже перенесены миграцией 143.
DROP TABLE IF EXISTS public.ai_tender_advisor_events;
DROP TABLE IF EXISTS public.ai_tender_digest_events;
