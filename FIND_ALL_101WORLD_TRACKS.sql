-- ==========================================
-- COMPREHENSIVE SEARCH FOR ALL 101WORLD TRACKS
-- Find ALL content from day 1 across all tables and ID columns
-- ==========================================

-- First, get all possible user IDs for 101world
WITH user_ids AS (
  SELECT DISTINCT clerk_user_id 
  FROM users 
  WHERE username = '101world' OR clerk_user_id LIKE '%101world%'
  
  UNION
  
  -- Add the known user ID
  SELECT 'user_34J8MP3KCfczODGn9yKMolWPX9R' as clerk_user_id
),

-- Get all tracks from combined_media table (uses user_id column)
combined_media_tracks AS (
  SELECT 
    'combined_media' as source_table,
    id,
    user_id as found_in_column,
    title,
    audio_url,
    image_url,
    audio_prompt as music_prompt,
    image_prompt,
    lyrics,
    is_published,
    created_at,
    updated_at
  FROM combined_media
  WHERE user_id IN (SELECT clerk_user_id FROM user_ids)
    AND audio_url IS NOT NULL
),

-- Get all tracks from combined_media_library (uses clerk_user_id column)
library_tracks AS (
  SELECT 
    'combined_media_library' as source_table,
    id,
    clerk_user_id as found_in_column,
    title,
    audio_url,
    image_url,
    music_prompt,
    image_prompt,
    lyrics,
    is_published,
    created_at,
    updated_at
  FROM combined_media_library
  WHERE clerk_user_id IN (SELECT clerk_user_id FROM user_ids)
),

-- Get all tracks from music_library if it exists (uses clerk_user_id column)
music_library_tracks AS (
  SELECT 
    'music_library' as source_table,
    id,
    clerk_user_id as found_in_column,
    title,
    audio_url,
    NULL as image_url,
    prompt as music_prompt,
    NULL as image_prompt,
    lyrics,
    FALSE as is_published,
    created_at,
    updated_at
  FROM music_library
  WHERE clerk_user_id IN (SELECT clerk_user_id FROM user_ids)
),

-- Combine all sources
all_tracks AS (
  SELECT * FROM combined_media_tracks
  UNION ALL
  SELECT * FROM library_tracks
  UNION ALL
  SELECT * FROM music_library_tracks
)

-- Final result with deduplication and metadata
SELECT 
  source_table,
  id,
  found_in_column,
  title,
  music_prompt,
  image_prompt,
  audio_url,
  image_url,
  lyrics,
  is_published,
  created_at,
  updated_at,
  -- Add row number for each unique audio_url to identify duplicates
  ROW_NUMBER() OVER (PARTITION BY audio_url ORDER BY created_at ASC) as duplicate_rank
FROM all_tracks
ORDER BY created_at DESC;

-- ==========================================
-- SUMMARY COUNTS BY SOURCE TABLE
-- ==========================================
SELECT 
  source_table,
  COUNT(*) as total_tracks,
  COUNT(DISTINCT audio_url) as unique_audio_urls,
  SUM(CASE WHEN is_published THEN 1 ELSE 0 END) as published_count
FROM (
  SELECT * FROM combined_media_tracks
  UNION ALL
  SELECT * FROM library_tracks
  UNION ALL
  SELECT * FROM music_library_tracks
) all_sources
GROUP BY source_table;

-- ==========================================
-- FIND DUPLICATES (Same audio_url in multiple tables)
-- ==========================================
WITH all_tracks_combined AS (
  SELECT * FROM combined_media_tracks
  UNION ALL
  SELECT * FROM library_tracks
  UNION ALL
  SELECT * FROM music_library_tracks
)
SELECT 
  audio_url,
  COUNT(*) as appearances,
  STRING_AGG(DISTINCT source_table, ', ') as found_in_tables,
  MIN(created_at) as first_created,
  MAX(created_at) as last_created
FROM all_tracks_combined
GROUP BY audio_url
HAVING COUNT(*) > 1
ORDER BY appearances DESC;

-- ==========================================
-- DEDUPLICATED LIST (One entry per audio_url, earliest created_at wins)
-- ==========================================
WITH all_tracks_combined AS (
  SELECT * FROM combined_media_tracks
  UNION ALL
  SELECT * FROM library_tracks
  UNION ALL
  SELECT * FROM music_library_tracks
),
ranked_tracks AS (
  SELECT 
    *,
    ROW_NUMBER() OVER (PARTITION BY audio_url ORDER BY created_at ASC) as rn
  FROM all_tracks_combined
)
SELECT 
  source_table,
  id,
  title,
  music_prompt,
  audio_url,
  image_url,
  is_published,
  created_at,
  updated_at
FROM ranked_tracks
WHERE rn = 1
ORDER BY created_at DESC;

-- ==========================================
-- TOTAL UNIQUE TRACKS COUNT
-- ==========================================
WITH all_tracks_combined AS (
  SELECT * FROM combined_media_tracks
  UNION ALL
  SELECT * FROM library_tracks
  UNION ALL
  SELECT * FROM music_library_tracks
)
SELECT 
  COUNT(DISTINCT audio_url) as total_unique_tracks,
  MIN(created_at) as oldest_track_date,
  MAX(created_at) as newest_track_date,
  COUNT(*) as total_entries_across_all_tables
FROM all_tracks_combined;
