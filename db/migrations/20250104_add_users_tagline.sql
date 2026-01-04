-- Add optional tagline to users profile
ALTER TABLE IF NOT EXISTS users
ADD COLUMN IF NOT EXISTS tagline text;

COMMENT ON COLUMN users.tagline IS 'Optional user tagline displayed on profiles.';
