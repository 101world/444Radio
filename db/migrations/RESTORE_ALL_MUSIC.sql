-- =====================================================
-- 444 RADIO: RESTORE ALL MUSIC TO LIBRARY
-- =====================================================
-- This copies ALL generated music into music_library
-- so the Music tab shows everything you've created
-- =====================================================

-- Step 1: Clear music_library
TRUNCATE TABLE music_library;

-- Step 2: Import ALL music from combined_media
-- This gets every track you've ever generated
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
SELECT DISTINCT ON (audio_url)
  user_id as clerk_user_id,
  COALESCE(title, 'Untitled Track') as title,
  COALESCE(audio_prompt, 'Generated music') as prompt,
  lyrics,
  audio_url,
  duration,
  'mp3' as audio_format,
  'ready' as status,
  created_at,
  NOW() as updated_at
FROM combined_media
WHERE audio_url IS NOT NULL
  AND audio_url != ''
ORDER BY audio_url, created_at DESC;

-- Step 3: Show what was imported
SELECT 
  COUNT(*) as total_tracks_imported,
  COUNT(DISTINCT clerk_user_id) as unique_users,
  MIN(created_at) as oldest_track,
  MAX(created_at) as newest_track
FROM music_library;

-- Step 4: Show your recent tracks
SELECT 
  title,
  LEFT(prompt, 60) as prompt_preview,
  created_at
FROM music_library
ORDER BY created_at DESC
LIMIT 20;

-- ✅ DONE! All your generated music is now in the Music library tab!
