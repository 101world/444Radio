-- Add username navigation and ensure all generations are linked to users
-- Run this in Supabase SQL Editor

-- 1. Ensure username column exists and is unique (for username-based URLs)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS username TEXT;

-- Create unique index on username (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower 
ON users (LOWER(username));

-- 2. Generate usernames for users who don't have one
-- Format: user_<first8chars of clerk_id>
UPDATE users 
SET username = 'user_' || SUBSTRING(clerk_user_id, 1, 8)
WHERE username IS NULL OR username = '';

-- 3. Add username to all songs for faster queries (denormalized)
ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS username TEXT;

-- Update existing songs with usernames
UPDATE songs s
SET username = u.username
FROM users u
WHERE s.user_id = u.clerk_user_id
AND (s.username IS NULL OR s.username = '');

-- 4. Create function to auto-update song username when user changes username
CREATE OR REPLACE FUNCTION sync_username_to_songs()
RETURNS TRIGGER AS $$
BEGIN
  -- Update all songs when username changes
  IF NEW.username != OLD.username OR (NEW.username IS NOT NULL AND OLD.username IS NULL) THEN
    UPDATE songs 
    SET username = NEW.username
    WHERE user_id = NEW.clerk_user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger to keep song usernames in sync
DROP TRIGGER IF EXISTS trigger_sync_username ON users;
CREATE TRIGGER trigger_sync_username
  AFTER UPDATE OF username ON users
  FOR EACH ROW
  EXECUTE FUNCTION sync_username_to_songs();

-- 6. Create indexes for username-based queries
CREATE INDEX IF NOT EXISTS idx_songs_username ON songs(username);
CREATE INDEX IF NOT EXISTS idx_songs_username_created ON songs(username, created_at DESC);

-- 7. Add RLS policy for username-based profile access
DROP POLICY IF EXISTS "Users can view profiles by username" ON users;
CREATE POLICY "Users can view profiles by username"
  ON users FOR SELECT
  USING (true); -- Everyone can view all profiles

-- 8. Verify the setup
SELECT 
  'Total users' as metric,
  COUNT(*) as count,
  COUNT(CASE WHEN username IS NOT NULL THEN 1 END) as with_username
FROM users
UNION ALL
SELECT 
  'Total songs' as metric,
  COUNT(*) as count,
  COUNT(CASE WHEN username IS NOT NULL THEN 1 END) as with_username
FROM songs;

-- Show sample usernames
SELECT clerk_user_id, email, username, total_generated 
FROM users 
LIMIT 5;
