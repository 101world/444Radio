-- ==========================================
-- VERIFY LIBRARY API DATA SOURCES
-- Check what each API endpoint should return for 101world
-- ==========================================

-- 1. CHECK: What /api/library/music should return
-- (Queries combined_media with user_id + combined_media_library with clerk_user_id)
SELECT 
  'MUSIC API SHOULD RETURN' as check_type,
  COUNT(*) as total_count,
  COUNT(DISTINCT audio_url) as unique_audio_urls
FROM (
  SELECT audio_url FROM combined_media 
  WHERE user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R' AND audio_url IS NOT NULL
  UNION
  SELECT audio_url FROM combined_media_library 
  WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
  UNION
  SELECT audio_url FROM music_library 
  WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
) all_music;

-- 2. BREAKDOWN: Show counts by table
SELECT 'combined_media (user_id)' as table_name, COUNT(*) as count
FROM combined_media 
WHERE user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R' AND audio_url IS NOT NULL

UNION ALL

SELECT 'combined_media_library (clerk_user_id)' as table_name, COUNT(*) as count
FROM combined_media_library 
WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'

UNION ALL

SELECT 'music_library (clerk_user_id)' as table_name, COUNT(*) as count
FROM music_library 
WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R';

-- 3. CHECK: What /api/library/releases should return
-- (Published items from both tables)
SELECT 
  'RELEASES API SHOULD RETURN' as check_type,
  COUNT(*) as total_count
FROM (
  SELECT id FROM combined_media 
  WHERE user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R' 
    AND is_published = TRUE 
    AND audio_url IS NOT NULL 
    AND image_url IS NOT NULL
  UNION
  SELECT id FROM combined_media_library 
  WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R' 
    AND is_published = TRUE
) all_releases;

-- 4. SHOW SAMPLE: First 5 tracks from each source
SELECT 'combined_media' as source, id, title, audio_url, created_at
FROM combined_media 
WHERE user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R' AND audio_url IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

SELECT 'combined_media_library' as source, id, title, audio_url, created_at
FROM combined_media_library 
WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
ORDER BY created_at DESC
LIMIT 5;

SELECT 'music_library' as source, id, title, audio_url, created_at
FROM music_library 
WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
ORDER BY created_at DESC
LIMIT 5;

-- 5. VERIFY: Are there tracks in music_library NOT in the other tables?
SELECT 
  'Tracks ONLY in music_library' as finding,
  COUNT(*) as count
FROM music_library ml
WHERE ml.clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
  AND NOT EXISTS (
    SELECT 1 FROM combined_media cm 
    WHERE cm.audio_url = ml.audio_url
  )
  AND NOT EXISTS (
    SELECT 1 FROM combined_media_library cml 
    WHERE cml.audio_url = ml.audio_url
  );

-- If count > 0, show those tracks:
SELECT ml.*
FROM music_library ml
WHERE ml.clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
  AND NOT EXISTS (
    SELECT 1 FROM combined_media cm 
    WHERE cm.audio_url = ml.audio_url
  )
  AND NOT EXISTS (
    SELECT 1 FROM combined_media_library cml 
    WHERE cml.audio_url = ml.audio_url
  )
ORDER BY created_at DESC;
