-- =====================================================
-- 444 RADIO: DIAGNOSE AND FIX MUSIC LIBRARY
-- =====================================================
-- Check what's wrong and fix the user_id/clerk_user_id issue
-- =====================================================

-- Step 1: Show what's in combined_media (your releases)
SELECT 
  'COMBINED_MEDIA (Releases)' as table_name,
  COUNT(*) as total_tracks,
  COUNT(DISTINCT user_id) as unique_users,
  user_id as sample_user_id
FROM combined_media
WHERE audio_url IS NOT NULL
GROUP BY user_id
LIMIT 5;

-- Step 2: Show what's in music_library currently
SELECT 
  'MUSIC_LIBRARY (Current)' as table_name,
  COUNT(*) as total_tracks,
  COUNT(DISTINCT clerk_user_id) as unique_users,
  clerk_user_id as sample_user_id
FROM music_library
GROUP BY clerk_user_id
LIMIT 5;

-- Step 3: Show a sample track from combined_media with all fields
SELECT 
  user_id,
  title,
  audio_prompt,
  audio_url,
  lyrics,
  duration,
  created_at
FROM combined_media
WHERE audio_url IS NOT NULL
ORDER BY created_at DESC
LIMIT 3;

-- Step 4: Now let's import EVERYTHING properly
TRUNCATE TABLE music_library;

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
  user_id as clerk_user_id,  -- Use whatever user_id is in combined_media
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

-- Step 5: Verify the import
SELECT 
  'IMPORT RESULT' as status,
  COUNT(*) as total_imported,
  COUNT(DISTINCT clerk_user_id) as unique_users
FROM music_library;

-- Step 6: Show your tracks
SELECT 
  clerk_user_id,
  title,
  LEFT(prompt, 50) as prompt_preview,
  created_at
FROM music_library
ORDER BY created_at DESC
LIMIT 10;

-- ✅ This will show you exactly what's happening and fix it!
