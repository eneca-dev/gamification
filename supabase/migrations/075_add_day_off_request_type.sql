ALTER TABLE day_off_requests
  ADD COLUMN request_type text NOT NULL DEFAULT 'day_off'
  CHECK (request_type IN ('day_off', 'business_trip'));
