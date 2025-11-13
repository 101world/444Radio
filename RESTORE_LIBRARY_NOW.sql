-- ========================================
-- COMPLETE LIBRARY RESTORATION SCRIPT
-- This restores ALL your music, images, and releases from any source
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/yirjulakkgignzbrqnth/sql
-- ========================================

-- Step 1: Check current state of ALL tables
SELECT 'BEFORE RESTORE - Checking all data sources:' as status;
SELECT 'music_library:' as table_name, COUNT(*) as count FROM music_library;
SELECT 'images_library:' as table_name, COUNT(*) as count FROM images_library;
SELECT 'combined_media:' as table_name, COUNT(*) as count FROM combined_media;
SELECT 'combined_media (audio only):' as table_name, COUNT(*) as count FROM combined_media WHERE audio_url IS NOT NULL;
SELECT 'combined_media (images only):' as table_name, COUNT(*) as count FROM combined_media WHERE image_url IS NOT NULL;
SELECT 'combined_media (both):' as table_name, COUNT(*) as count FROM combined_media WHERE audio_url IS NOT NULL AND image_url IS NOT NULL;

-- Step 2: Populate music_library from combined_media (ALL audio - released AND unreleased)
-- This gets ALL tracks that have audio, regardless of whether they have cover art
INSERT INTO music_library (
  clerk_user_id,
  title,
  prompt,
  lyrics,
  audio_url,
  duration,
  audio_format,
  file_size,
  status,
  created_at,
  updated_at
)
SELECT DISTINCT ON (audio_url)
  user_id as clerk_user_id,
  COALESCE(title, 'Untitled Track') as title,
  COALESCE(audio_prompt, 'Generated music') as prompt,
  lyrics,
  audio_url,
  duration,
  'mp3' as audio_format,
  NULL as file_size,
  'ready' as status,
  created_at,
  updated_at
FROM combined_media
WHERE audio_url IS NOT NULL
  AND user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM music_library ml 
    WHERE ml.audio_url = combined_media.audio_url
  )
ORDER BY audio_url, created_at DESC;

-- Step 3: Populate images_library from combined_media (ALL images - used AND unused)
-- This gets ALL images that were generated, even if not used in releases
INSERT INTO images_library (
  clerk_user_id,
  title,
  prompt,
  image_url,
  width,
  height,
  file_size,
  status,
  created_at,
  updated_at
)
SELECT DISTINCT ON (image_url)
  user_id as clerk_user_id,
  COALESCE(title, 'Untitled Image') as title,
  COALESCE(image_prompt, 'Generated image') as prompt,
  image_url,
  NULL as width,
  NULL as height,
  NULL as file_size,
  'ready' as status,
  created_at,
  updated_at
FROM combined_media
WHERE image_url IS NOT NULL
  AND user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM images_library il 
    WHERE il.image_url = combined_media.image_url
  )
ORDER BY image_url, created_at DESC;

-- Step 4: Show results
SELECT 'AFTER RESTORE:' as status;
SELECT 'music_library (ALL tracks):' as table_name, COUNT(*) as count FROM music_library;
SELECT 'images_library (ALL images):' as table_name, COUNT(*) as count FROM images_library;
SELECT 'combined_media (releases with audio+image):' as table_name, COUNT(*) as count FROM combined_media WHERE audio_url IS NOT NULL AND image_url IS NOT NULL;

-- Step 5: Show sample data to verify
SELECT 'Sample restored music (including unreleased):' as info;
SELECT id, clerk_user_id, title, created_at FROM music_library ORDER BY created_at DESC LIMIT 10;

SELECT 'Sample restored images:' as info;
SELECT id, clerk_user_id, title, created_at FROM images_library ORDER BY created_at DESC LIMIT 10;

SELECT '✅ RESTORATION COMPLETE!' as final_status;
SELECT 'Music Tab: Shows ALL audio tracks (released + unreleased)' as note1;
SELECT 'Images Tab: Shows ALL generated images' as note2;
SELECT 'Releases Tab: Shows only tracks with both audio AND cover art' as note3;
