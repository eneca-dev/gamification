CREATE TABLE feedback (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  type            text NOT NULL CHECK (type IN ('bug', 'suggestion')),
  header          text NOT NULL,
  description     text,
  expected_behavior text,
  image_urls      text[] NOT NULL DEFAULT '{}',
  airtable_id     text,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name       text,
  user_department text,
  user_team       text
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Любой авторизованный пользователь может добавить запись
CREATE POLICY "Users can submit feedback"
  ON feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Пользователь видит только свои записи (admin query использует admin client, минуя RLS)
CREATE POLICY "Users can read own feedback"
  ON feedback FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
