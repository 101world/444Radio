-- Migration: Add last_444_radio_date to users table for daily 444 Radio limit
BEGIN;

ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS last_444_radio_date DATE;

CREATE INDEX IF NOT EXISTS idx_users_last_444_radio_date ON users (last_444_radio_date);

COMMIT;

-- Note: Review privileges and run in staging before production.
