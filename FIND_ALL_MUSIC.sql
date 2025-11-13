-- ========================================
-- DIAGNOSTIC: Find ALL music across ALL tables
-- Run this in Supabase to see where the missing songs are
-- ========================================

-- Check all possible tables for music
SELECT 'music_library' as source, COUNT(*) as count, clerk_user_id 
FROM music_library 
GROUP BY clerk_user_id 
ORDER BY count DESC;

SELECT 'combined_media (with audio)' as source, COUNT(*) as count, user_id 
FROM combined_media 
WHERE audio_url IS NOT NULL 
GROUP BY user_id 
ORDER BY count DESC;

-- Check if there's a songs table (old table)
SELECT 'songs (if exists)' as source, COUNT(*) as count, user_id 
FROM songs 
GROUP BY user_id 
ORDER BY count DESC;

-- Show all tables in the database
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
AND (
  table_name LIKE '%music%' 
  OR table_name LIKE '%song%' 
  OR table_name LIKE '%audio%'
  OR table_name LIKE '%track%'
  OR table_name LIKE '%library%'
  OR table_name LIKE '%media%'
)
ORDER BY table_name;

-- For a specific user, show what exists where
-- Replace 'user_xxx' with the actual clerk_user_id
SELECT 'Music in music_library for user_34IRTbbo6kCHjWMZvXYTBWepAtw:' as info;
SELECT id, title, audio_url, created_at 
FROM music_library 
WHERE clerk_user_id = 'user_34IRTbbo6kCHjWMZvXYTBWepAtw' 
ORDER BY created_at DESC;

SELECT 'Audio in combined_media for user_34IRTbbo6kCHjWMZvXYTBWepAtw:' as info;
SELECT id, title, audio_url, created_at 
FROM combined_media 
WHERE user_id = 'user_34IRTbbo6kCHjWMZvXYTBWepAtw' 
AND audio_url IS NOT NULL
ORDER BY created_at DESC;
