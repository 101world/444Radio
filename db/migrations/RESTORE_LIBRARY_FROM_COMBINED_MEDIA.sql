-- ========================================
-- RESTORE LIBRARY TABLES FROM COMBINED_MEDIA
-- This populates music_library and images_library from existing combined_media data
-- ========================================

BEGIN;

-- 1. Clear existing library data (optional - comment out if you want to keep existing)
-- TRUNCATE music_library CASCADE;
-- TRUNCATE images_library CASCADE;

-- 2. Populate music_library from combined_media (all items with audio)
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
  COALESCE(audio_prompt, prompt, 'Generated music') as prompt,
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

-- 3. Populate images_library from combined_media (all items with images)
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
  COALESCE(image_prompt, prompt, 'Generated image') as prompt,
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

-- 4. Show results
SELECT 'Restore complete!' as status;
SELECT 'music_library count:' as table_name, COUNT(*) as count FROM music_library;
SELECT 'images_library count:' as table_name, COUNT(*) as count FROM images_library;
SELECT 'combined_media count:' as table_name, COUNT(*) as count FROM combined_media;

COMMIT;
