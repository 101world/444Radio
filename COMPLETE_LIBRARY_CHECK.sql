-- ==========================================
-- FINAL COMPREHENSIVE CHECK
-- Shows EXACTLY what the library page will display
-- Run this in Supabase SQL Editor
-- ==========================================

-- YOUR USER ID
-- user_34J8MP3KCfczODGn9yKMolWPX9R (101world)

-- ==========================================
-- PART 1: TOTAL COUNT (What you should see)
-- ==========================================
WITH all_sources AS (
  SELECT audio_url, created_at, 'combined_media' as source
  FROM combined_media 
  WHERE user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R' AND audio_url IS NOT NULL
  
  UNION
  
  SELECT audio_url, created_at, 'combined_media_library' as source
  FROM combined_media_library 
  WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
  
  UNION
  
  SELECT audio_url, created_at, 'music_library' as source
  FROM music_library 
  WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
)
SELECT 
  '🎵 TOTAL UNIQUE TRACKS' as metric,
  COUNT(DISTINCT audio_url) as count,
  '(This is what should show in Music tab)' as note
FROM all_sources;

-- ==========================================
-- PART 2: BREAKDOWN BY TABLE
-- ==========================================
SELECT '📊 BREAKDOWN BY SOURCE TABLE' as section;

SELECT 
  'combined_media (user_id)' as source_table,
  COUNT(*) as track_count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM combined_media 
WHERE user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R' AND audio_url IS NOT NULL

UNION ALL

SELECT 
  'combined_media_library (clerk_user_id)' as source_table,
  COUNT(*) as track_count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM combined_media_library 
WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'

UNION ALL

SELECT 
  'music_library (clerk_user_id)' as source_table,
  COUNT(*) as track_count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM music_library 
WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R';

-- ==========================================
-- PART 3: ALL YOUR TRACKS (Deduplicated)
-- ==========================================
SELECT '🎼 ALL YOUR TRACKS (DEDUPLICATED)' as section;

WITH all_tracks AS (
  SELECT 
    'combined_media' as source,
    id,
    title,
    audio_url,
    image_url,
    audio_prompt as prompt,
    lyrics,
    is_published,
    created_at
  FROM combined_media 
  WHERE user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R' AND audio_url IS NOT NULL
  
  UNION ALL
  
  SELECT 
    'combined_media_library' as source,
    id,
    title,
    audio_url,
    image_url,
    music_prompt as prompt,
    lyrics,
    is_published,
    created_at
  FROM combined_media_library 
  WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
  
  UNION ALL
  
  SELECT 
    'music_library' as source,
    id,
    title,
    audio_url,
    NULL as image_url,
    prompt,
    lyrics,
    FALSE as is_published,
    created_at
  FROM music_library 
  WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
),
ranked AS (
  SELECT 
    *,
    ROW_NUMBER() OVER (PARTITION BY audio_url ORDER BY created_at ASC) as rn
  FROM all_tracks
)
SELECT 
  source,
  title,
  prompt,
  CASE WHEN is_published THEN '✅ Published' ELSE '⏳ Draft' END as status,
  created_at::date as date_created
FROM ranked
WHERE rn = 1
ORDER BY created_at DESC;

-- ==========================================
-- PART 4: DUPLICATE CHECK
-- ==========================================
SELECT '🔍 DUPLICATES ACROSS TABLES' as section;

WITH all_tracks AS (
  SELECT audio_url, created_at, 'combined_media' as source FROM combined_media WHERE user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R' AND audio_url IS NOT NULL
  UNION ALL
  SELECT audio_url, created_at, 'combined_media_library' as source FROM combined_media_library WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
  UNION ALL
  SELECT audio_url, created_at, 'music_library' as source FROM music_library WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
)
SELECT 
  audio_url,
  COUNT(*) as appears_in_x_tables,
  STRING_AGG(DISTINCT source, ' + ') as tables
FROM all_tracks
GROUP BY audio_url
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- ==========================================
-- PART 5: PUBLISHED RELEASES COUNT
-- ==========================================
SELECT '💿 PUBLISHED RELEASES' as section;

WITH all_published AS (
  SELECT id, title, audio_url, image_url, created_at
  FROM combined_media 
  WHERE user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R' 
    AND is_published = TRUE 
    AND audio_url IS NOT NULL 
    AND image_url IS NOT NULL
  
  UNION
  
  SELECT id, title, audio_url, image_url, created_at
  FROM combined_media_library 
  WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R' 
    AND is_published = TRUE
)
SELECT 
  COUNT(DISTINCT audio_url) as total_published_releases,
  '(This is what should show in Releases tab)' as note
FROM all_published;

-- ==========================================
-- SUMMARY
-- ==========================================
SELECT '📝 SUMMARY' as section;

SELECT 
  'Music Tab' as tab,
  COUNT(DISTINCT audio_url) as count,
  'All generated music' as description
FROM (
  SELECT audio_url FROM combined_media WHERE user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R' AND audio_url IS NOT NULL
  UNION
  SELECT audio_url FROM combined_media_library WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
  UNION
  SELECT audio_url FROM music_library WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
) all_music

UNION ALL

SELECT 
  'Images Tab' as tab,
  COUNT(DISTINCT image_url) as count,
  'All generated images' as description
FROM (
  SELECT image_url FROM images_library WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
  UNION
  SELECT image_url FROM combined_media WHERE user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R' AND image_url IS NOT NULL
) all_images

UNION ALL

SELECT 
  'Releases Tab' as tab,
  COUNT(DISTINCT audio_url) as count,
  'Published tracks only' as description
FROM (
  SELECT audio_url FROM combined_media WHERE user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R' AND is_published = TRUE AND audio_url IS NOT NULL AND image_url IS NOT NULL
  UNION
  SELECT audio_url FROM combined_media_library WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R' AND is_published = TRUE
) all_releases;
