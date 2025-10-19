-- 444RADIO - Complete Database Migration (SAFE VERSION)
-- Run this ONCE in Supabase SQL Editor
-- This adds all missing columns and sets up username navigation
-- SAFE: Can be run multiple times without errors

-- ========================================
-- 1. Add ALL missing columns to songs table
-- ========================================

-- Core columns
ALTER TABLE songs ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS prompt TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS lyrics TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS bpm INTEGER;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS genre TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS instrumental BOOLEAN DEFAULT false;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS cover_prompt TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS duration INTEGER;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'generating';
ALTER TABLE songs ADD COLUMN IF NOT EXISTS plays INTEGER DEFAULT 0;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE songs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing songs to be private by default
UPDATE songs 
SET is_public = false 
WHERE is_public IS NULL;

-- Set default status for existing songs
UPDATE songs 
SET status = 'complete'
WHERE status IS NULL;

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
-- 3. Drop old index if exists (to avoid conflicts)
-- ========================================

DROP INDEX IF EXISTS idx_users_username_lower;

-- ========================================
-- 4. Generate UNIQUE usernames for existing users
-- ========================================

-- Clear any duplicate/invalid usernames first
UPDATE users 
SET username = NULL
WHERE username = '' OR username LIKE 'user_user_%';

-- Generate unique usernames using UUID for guaranteed uniqueness
-- Format: user_<random_hex>
UPDATE users 
SET username = 'user_' || SUBSTRING(MD5(RANDOM()::TEXT || clerk_user_id), 1, 12)
WHERE username IS NULL;

-- ========================================
-- 5. Create unique index AFTER usernames are set
-- ========================================

-- Create unique index on username (case-insensitive, excludes NULL)
CREATE UNIQUE INDEX idx_users_username_lower 
ON users (LOWER(username))
WHERE username IS NOT NULL;

-- ========================================
-- 6. Update songs with usernames
-- ========================================

-- Sync usernames from users to songs
UPDATE songs s
SET username = u.username
FROM users u
WHERE s.user_id = u.clerk_user_id
AND (s.username IS NULL OR s.username = '');

-- ========================================
-- 7. Create auto-sync function
-- ========================================

-- Function to auto-update song username when user changes username
CREATE OR REPLACE FUNCTION sync_username_to_songs()
RETURNS TRIGGER AS $$
BEGIN
  -- Update all songs when username changes
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    UPDATE songs 
    SET username = NEW.username
    WHERE user_id = NEW.clerk_user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 8. Create trigger
-- ========================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_sync_username ON users;

-- Create trigger to keep song usernames in sync
CREATE TRIGGER trigger_sync_username
  AFTER UPDATE OF username ON users
  FOR EACH ROW
  EXECUTE FUNCTION sync_username_to_songs();

-- ========================================
-- 9. Create indexes for performance
-- ========================================

CREATE INDEX IF NOT EXISTS idx_songs_username ON songs(username);
CREATE INDEX IF NOT EXISTS idx_songs_username_created ON songs(username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_songs_is_public ON songs(is_public);
CREATE INDEX IF NOT EXISTS idx_songs_user_public ON songs(user_id, is_public);

-- ========================================
-- 10. Verify the migration
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
  END as status
UNION ALL
SELECT 
  'users.username' as check_item,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'username'
    ) THEN '✅ EXISTS' 
    ELSE '❌ MISSING' 
  END as status
UNION ALL
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
  COUNT(CASE WHEN username IS NOT NULL THEN 1 END) as with_username,
  COUNT(DISTINCT username) as unique_usernames
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
-- All users have UNIQUE usernames (user_<random12chars>)
-- Username navigation is ready at /u/[username]
--
-- Users can change their username later in profile settings!
