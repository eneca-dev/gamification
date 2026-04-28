-- Добавляем массив просмотренных онбординг-туров в profiles
-- Используется как источник истины при смене браузера / очистке localStorage
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_seen text[] NOT NULL DEFAULT '{}';

-- Индекс не нужен: запросы всегда по user_id (PK), массив читается целиком
