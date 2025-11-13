-- ========================================
-- DIAGNOSTIC: Why are only 22 of 40 songs showing?
-- ========================================

-- Step 1: Count songs in combined_media for this user
SELECT 'Songs in combined_media (source):' as info, COUNT(*) as count
FROM combined_media
WHERE user_id = 'user_34IRTbbo6kCHjWMZvXYTBWepAtw'
AND audio_url IS NOT NULL;

-- Step 2: Count songs in music_library for this user
SELECT 'Songs in music_library (library):' as info, COUNT(*) as count
FROM music_library
WHERE clerk_user_id = 'user_34IRTbbo6kCHjWMZvXYTBWepAtw';

-- Step 3: Check for duplicates (same audio_url multiple times)
SELECT 'Duplicate audio_urls in combined_media:' as info;
SELECT audio_url, COUNT(*) as occurrences
FROM combined_media
WHERE user_id = 'user_34IRTbbo6kCHjWMZvXYTBWepAtw'
AND audio_url IS NOT NULL
GROUP BY audio_url
HAVING COUNT(*) > 1
ORDER BY occurrences DESC;

-- Step 4: Find songs in combined_media that are NOT in music_library
SELECT 'Songs missing from music_library:' as info;
SELECT cm.id, cm.title, cm.audio_url, cm.created_at
FROM combined_media cm
WHERE cm.user_id = 'user_34IRTbbo6kCHjWMZvXYTBWepAtw'
AND cm.audio_url IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM music_library ml
  WHERE ml.audio_url = cm.audio_url
)
ORDER BY cm.created_at DESC;

-- Step 5: Show all unique audio URLs (to count true unique songs)
SELECT 'Total unique audio URLs in combined_media:' as info, COUNT(DISTINCT audio_url) as count
FROM combined_media
WHERE user_id = 'user_34IRTbbo6kCHjWMZvXYTBWepAtw'
AND audio_url IS NOT NULL;

-- Step 6: Insert any missing songs
INSERT INTO music_library (
  clerk_user_id,
  title,
  prompt,
  lyrics,
  audio_url,
  duration,
  audio_format,
  status,
  created_at,
  updated_at
)
SELECT DISTINCT ON (cm.audio_url)
  cm.user_id,
  COALESCE(cm.title, 'Untitled'),
  COALESCE(cm.audio_prompt, 'Generated music'),
  cm.lyrics,
  cm.audio_url,
  cm.duration,
  'mp3',
  'ready',
  cm.created_at,
  COALESCE(cm.updated_at, cm.created_at)
FROM combined_media cm
WHERE cm.user_id = 'user_34IRTbbo6kCHjWMZvXYTBWepAtw'
AND cm.audio_url IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM music_library ml
  WHERE ml.audio_url = cm.audio_url
)
ORDER BY cm.audio_url, cm.created_at DESC;

-- Step 7: Final count
SELECT 'AFTER fixing - music_library count:' as info, COUNT(*) as count
FROM music_library
WHERE clerk_user_id = 'user_34IRTbbo6kCHjWMZvXYTBWepAtw';

SELECT '✅ All missing songs should now be added!' as status;
