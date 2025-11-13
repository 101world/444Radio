-- QUICK VERSION: Show all 101world tracks deduplicated
-- Run this in Supabase SQL Editor

WITH all_tracks AS (
  -- From combined_media (uses user_id)
  SELECT 
    'combined_media' as source,
    id, title, audio_url, image_url, created_at, is_published
  FROM combined_media
  WHERE user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R' 
    AND audio_url IS NOT NULL
  
  UNION ALL
  
  -- From combined_media_library (uses clerk_user_id)
  SELECT 
    'combined_media_library' as source,
    id, title, audio_url, image_url, created_at, is_published
  FROM combined_media_library
  WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
  
  UNION ALL
  
  -- From music_library (uses clerk_user_id)
  SELECT 
    'music_library' as source,
    id, title, audio_url, NULL as image_url, created_at, FALSE as is_published
  FROM music_library
  WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
),
deduplicated AS (
  SELECT 
    *,
    ROW_NUMBER() OVER (PARTITION BY audio_url ORDER BY created_at ASC) as rn
  FROM all_tracks
)
SELECT 
  source,
  id,
  title,
  audio_url,
  image_url,
  is_published,
  created_at
FROM deduplicated
WHERE rn = 1
ORDER BY created_at DESC;

-- Get the count
WITH all_tracks AS (
  SELECT audio_url FROM combined_media WHERE user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R' AND audio_url IS NOT NULL
  UNION
  SELECT audio_url FROM combined_media_library WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
  UNION
  SELECT audio_url FROM music_library WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
)
SELECT COUNT(*) as total_unique_tracks FROM all_tracks;
