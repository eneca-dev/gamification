-- Расширяем таблицу feedback типом 'appeal' — обжалование списания 💎
-- Хранится в той же таблице, что баги и предложения: тип + дополнительные поля appeal_*.

ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_type_check;

ALTER TABLE feedback
  ADD CONSTRAINT feedback_type_check
  CHECK (type IN ('bug', 'suggestion', 'appeal'));

-- Поля, валидные только для type = 'appeal' (nullable для остальных типов)
ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS appeal_dates        date[],
  ADD COLUMN IF NOT EXISTS appeal_task_url     text,
  ADD COLUMN IF NOT EXISTS appeal_manager_name text,
  ADD COLUMN IF NOT EXISTS appeal_total_coins  integer,
  ADD COLUMN IF NOT EXISTS status              text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS review_comment      text,
  ADD COLUMN IF NOT EXISTS reviewed_at         timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_status_check;
ALTER TABLE feedback
  ADD CONSTRAINT feedback_status_check
  CHECK (status IN ('new', 'approved', 'rejected'));

-- Быстрый выбор обжалований конкретного пользователя (на странице корректировок)
CREATE INDEX IF NOT EXISTS idx_feedback_user_type ON feedback (user_id, type);
CREATE INDEX IF NOT EXISTS idx_feedback_type_status ON feedback (type, status);

-- Прямая связь с ws_users: для навигации из обжалования в карточку корректировок
ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS ws_user_id uuid REFERENCES ws_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_feedback_ws_user_type ON feedback (ws_user_id, type);
