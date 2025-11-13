-- ========================================
-- FIND AND RESTORE ALL MISSING MUSIC
-- This will find music in ANY table and restore it to music_library
-- ========================================

-- Step 1: Show what we have now
SELECT '=== CURRENT STATE ===' as step;

SELECT 'music_library total:' as metric, COUNT(*) as count FROM music_library;

SELECT 'Per user in music_library:' as metric;
SELECT clerk_user_id, COUNT(*) as song_count 
FROM music_library 
GROUP BY clerk_user_id 
ORDER BY song_count DESC 
LIMIT 10;

-- Step 2: Check combined_media for audio
SELECT 'Audio in combined_media:' as metric, COUNT(*) as count 
FROM combined_media 
WHERE audio_url IS NOT NULL;

SELECT 'Per user in combined_media (audio):' as metric;
SELECT user_id, COUNT(*) as song_count 
FROM combined_media 
WHERE audio_url IS NOT NULL 
GROUP BY user_id 
ORDER BY song_count DESC 
LIMIT 10;

-- Step 3: Find songs in combined_media that are NOT in music_library
SELECT '=== MISSING SONGS ===' as step;

SELECT 'Songs in combined_media but NOT in music_library:' as metric, COUNT(*) as count
FROM combined_media cm
WHERE cm.audio_url IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM music_library ml 
  WHERE ml.audio_url = cm.audio_url
);

-- Step 4: Show sample of missing songs
SELECT 'Sample missing songs:' as info;
SELECT cm.id, cm.user_id, cm.title, cm.audio_url, cm.created_at
FROM combined_media cm
WHERE cm.audio_url IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM music_library ml 
  WHERE ml.audio_url = cm.audio_url
)
ORDER BY cm.created_at DESC
LIMIT 20;

-- Step 5: RESTORE ALL MISSING SONGS
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
SELECT DISTINCT ON (cm.audio_url)
  cm.user_id as clerk_user_id,
  COALESCE(cm.title, 'Untitled Track') as title,
  COALESCE(cm.audio_prompt, 'Generated music') as prompt,
  cm.lyrics,
  cm.audio_url,
  cm.duration,
  'mp3' as audio_format,
  NULL as file_size,
  'ready' as status,
  cm.created_at,
  cm.updated_at
FROM combined_media cm
WHERE cm.audio_url IS NOT NULL
  AND cm.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM music_library ml 
    WHERE ml.audio_url = cm.audio_url
  )
ORDER BY cm.audio_url, cm.created_at DESC;

-- Step 6: Show final counts
SELECT '=== AFTER RESTORE ===' as step;

SELECT 'music_library total:' as metric, COUNT(*) as count FROM music_library;

SELECT 'Per user after restore:' as metric;
SELECT clerk_user_id, COUNT(*) as song_count 
FROM music_library 
GROUP BY clerk_user_id 
ORDER BY song_count DESC 
LIMIT 10;

-- Step 7: Verify specific user (replace with actual user ID)
SELECT 'Songs for user_34IRTbbo6kCHjWMZvXYTBWepAtw:' as info;
SELECT id, title, audio_url, created_at 
FROM music_library 
WHERE clerk_user_id = 'user_34IRTbbo6kCHjWMZvXYTBWepAtw' 
ORDER BY created_at DESC;

SELECT '✅ DONE! Check music_library counts above.' as final_status;
