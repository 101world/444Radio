-- 444RADIO - Complete Database Migration
-- Run this ONCE in Supabase SQL Editor
-- This adds all missing columns and sets up username navigation

-- ========================================
-- 1. Add is_public column to songs
-- ========================================

ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Update existing songs to be private by default
UPDATE songs 
SET is_public = false 
WHERE is_public IS NULL;

-- ========================================
-- 2. Add username columns
-- ========================================

-- Add username to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS username TEXT;

-- Add username to songs table (denormalized for speed)
ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS username TEXT;

-- ========================================
-- 3. Create unique index on username
-- ========================================

-- Create unique index on username (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower 
ON users (LOWER(username));

-- ========================================
-- 4. Generate usernames for existing users
-- ========================================

-- Format: user_<first8chars of clerk_id>
UPDATE users 
SET username = 'user_' || SUBSTRING(clerk_user_id, 1, 8)
WHERE username IS NULL OR username = '';

-- ========================================
-- 5. Update songs with usernames
-- ========================================

-- Sync usernames from users to songs
UPDATE songs s
SET username = u.username
FROM users u
WHERE s.user_id = u.clerk_user_id
AND (s.username IS NULL OR s.username = '');

-- ========================================
-- 6. Create auto-sync function
-- ========================================

-- Function to auto-update song username when user changes username
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

-- ========================================
-- 7. Create trigger
-- ========================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_sync_username ON users;

-- Create trigger to keep song usernames in sync
CREATE TRIGGER trigger_sync_username
  AFTER UPDATE OF username ON users
  FOR EACH ROW
  EXECUTE FUNCTION sync_username_to_songs();

-- ========================================
-- 8. Create indexes for performance
-- ========================================

CREATE INDEX IF NOT EXISTS idx_songs_username ON songs(username);
CREATE INDEX IF NOT EXISTS idx_songs_username_created ON songs(username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_songs_is_public ON songs(is_public);
CREATE INDEX IF NOT EXISTS idx_songs_user_public ON songs(user_id, is_public);

-- ========================================
-- 9. Verify the migration
-- ========================================

-- Check columns were added
SELECT 
  'songs.is_public' as check_item,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'songs' AND column_name = 'is_public'
    ) THEN '✅ EXISTS' 
    ELSE '❌ MISSING' 
  END as status;

SELECT 
  'users.username' as check_item,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'username'
    ) THEN '✅ EXISTS' 
    ELSE '❌ MISSING' 
  END as status;

SELECT 
  'songs.username' as check_item,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'songs' AND column_name = 'username'
    ) THEN '✅ EXISTS' 
    ELSE '❌ MISSING' 
  END as status;

-- Show user statistics
SELECT 
  'Total users' as metric,
  COUNT(*) as count,
  COUNT(CASE WHEN username IS NOT NULL THEN 1 END) as with_username
FROM users;

-- Show song statistics
SELECT 
  'Total songs' as metric,
  COUNT(*) as count,
  COUNT(CASE WHEN username IS NOT NULL THEN 1 END) as with_username,
  COUNT(CASE WHEN is_public = true THEN 1 END) as public_songs,
  COUNT(CASE WHEN is_public = false THEN 1 END) as private_songs
FROM songs;

-- Show sample data
SELECT 
  clerk_user_id, 
  email, 
  username, 
  credits,
  total_generated 
FROM users 
LIMIT 5;

-- ========================================
-- ✅ MIGRATION COMPLETE!
-- ========================================
-- You should see all ✅ checkmarks above
-- All existing songs are now PRIVATE by default
-- All users have usernames
-- Username navigation is ready at /u/[username]
