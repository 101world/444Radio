-- ==========================================
-- QUICK COUNT - How many songs does 101world actually have?
-- Run this in Supabase SQL Editor
-- ==========================================

-- Your Clerk User ID
-- user_34J8MP3KCfczODGn9yKMolWPX9R

-- Count from each table
SELECT 
  'combined_media (user_id)' as table_name,
  COUNT(*) as song_count
FROM combined_media 
WHERE user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R' AND audio_url IS NOT NULL

UNION ALL

SELECT 
  'combined_media_library (clerk_user_id)' as table_name,
  COUNT(*) as song_count
FROM combined_media_library 
WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'

UNION ALL

SELECT 
  'music_library (clerk_user_id)' as table_name,
  COUNT(*) as song_count
FROM music_library 
WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'

UNION ALL

SELECT 
  '🎵 TOTAL UNIQUE (what library should show)' as table_name,
  COUNT(DISTINCT audio_url) as song_count
FROM (
  SELECT audio_url FROM combined_media WHERE user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R' AND audio_url IS NOT NULL
  UNION
  SELECT audio_url FROM combined_media_library WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
  UNION
  SELECT audio_url FROM music_library WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
) all_songs;
