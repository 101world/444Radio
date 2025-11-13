-- ==========================================
-- SIMPLE TRACK COUNT - 101WORLD
-- No complex CTEs, just counts
-- ==========================================

-- 1. Count from combined_media
SELECT 
  'combined_media' as table_name,
  COUNT(*) as tracks
FROM combined_media 
WHERE user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R' 
  AND audio_url IS NOT NULL;

-- 2. Count from combined_media_library
SELECT 
  'combined_media_library' as table_name,
  COUNT(*) as tracks
FROM combined_media_library 
WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R';

-- 3. Count from music_library
SELECT 
  'music_library' as table_name,
  COUNT(*) as tracks
FROM music_library 
WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R';

-- 4. TOTAL UNIQUE (deduplicated by audio_url)
WITH all_urls AS (
  SELECT audio_url FROM combined_media 
  WHERE user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R' AND audio_url IS NOT NULL
  
  UNION
  
  SELECT audio_url FROM combined_media_library 
  WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
  
  UNION
  
  SELECT audio_url FROM music_library 
  WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
)
SELECT 
  'TOTAL UNIQUE TRACKS' as summary,
  COUNT(*) as tracks
FROM all_urls;

-- 5. Show all tracks with source
SELECT 
  'combined_media' as source,
  title,
  created_at::date as date
FROM combined_media 
WHERE user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R' AND audio_url IS NOT NULL

UNION ALL

SELECT 
  'combined_media_library' as source,
  title,
  created_at::date as date
FROM combined_media_library 
WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'

UNION ALL

SELECT 
  'music_library' as source,
  title,
  created_at::date as date
FROM music_library 
WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'

ORDER BY date DESC;
