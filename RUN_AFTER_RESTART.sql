-- ============================================
-- RUN THIS AFTER SUPABASE RESTARTS
-- ============================================
-- Run in Supabase SQL Editor once database is back online

-- 1. Restore credits to all users
UPDATE users 
SET credits = 20 
WHERE credits = 0 OR credits IS NULL;

-- 2. Add tagline column (safe - won't error if exists)
ALTER TABLE users ADD COLUMN IF NOT EXISTS tagline text;

-- 3. Verify fixes worked
SELECT 
  COUNT(*) as total_users,
  SUM(CASE WHEN credits >= 20 THEN 1 ELSE 0 END) as users_with_credits,
  COUNT(*) FILTER (WHERE tagline IS NOT NULL) as users_with_tagline
FROM users;

-- 4. Check if tracks exist
SELECT 
  COUNT(*) as total_tracks,
  COUNT(DISTINCT user_id) as unique_artists,
  COUNT(*) FILTER (WHERE audio_url IS NOT NULL) as tracks_with_audio
FROM combined_media;

-- 5. Show sample data
SELECT id, title, user_id, plays, likes, created_at 
FROM combined_media 
ORDER BY created_at DESC 
LIMIT 5;
