-- Keep publication history while showing only news within its display window.
ALTER TABLE public.company_news
  ADD COLUMN expires_at timestamptz;

UPDATE public.company_news
SET expires_at = published_at + interval '7 days'
WHERE published_at IS NOT NULL;

-- Legacy categories become application changes; bug notices retain their severity.
UPDATE public.company_news
SET category = 'app_changes'
WHERE category <> 'bug';

ALTER TABLE public.company_news DROP CONSTRAINT company_news_category_check;
ALTER TABLE public.company_news
  ADD CONSTRAINT company_news_category_check CHECK (category IN ('bug', 'app_changes'));
ALTER TABLE public.company_news
  ADD CONSTRAINT company_news_publication_window_check
  CHECK (published_at IS NULL OR (expires_at IS NOT NULL AND expires_at > published_at));
