-- Match the monthly AI achievement descriptions to one qualifying use.
-- Award switches remain unchanged and disabled.
UPDATE public.gamification_event_types
SET description = 'Одна проверка документа за месяц выполняет условие достижения'
WHERE key = 'ai_norm_check_monthly';

UPDATE public.gamification_event_types
SET name = 'Tender Adviser: использование в месяц',
    description = 'Один запуск приложения за месяц выполняет условие достижения'
WHERE key = 'ai_tender_advisor_monthly';

UPDATE public.gamification_event_types
SET name = 'Tender Digest: использование в месяц',
    description = 'Один просмотр тендера, решение по тендеру или создание лида за месяц выполняет условие достижения'
WHERE key = 'ai_tender_digest_monthly';
