-- ========================================
-- SIMPLE RESTORE - Copy ALL songs to music_library
-- This is a clean, simple restore that WILL work
-- ========================================

-- Step 1: Clear music_library (start fresh)
TRUNCATE music_library CASCADE;

-- Step 2: Insert ALL songs from combined_media
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
  user_id,
  COALESCE(title, 'Untitled'),
  COALESCE(audio_prompt, 'Generated music'),
  lyrics,
  audio_url,
  duration,
  'mp3',
  'ready',
  created_at,
  COALESCE(updated_at, created_at)
FROM combined_media
WHERE audio_url IS NOT NULL
  AND user_id IS NOT NULL
ORDER BY audio_url, created_at DESC;

-- Step 3: Show results
SELECT 'Total songs restored:' as result, COUNT(*) as count FROM music_library;

SELECT 'Songs per user:' as result;
SELECT clerk_user_id, COUNT(*) as songs 
FROM music_library 
GROUP BY clerk_user_id 
ORDER BY songs DESC;

SELECT 'Sample songs:' as result;
SELECT id, clerk_user_id, title, created_at 
FROM music_library 
ORDER BY created_at DESC 
LIMIT 20;

SELECT '✅ ALL SONGS RESTORED TO music_library!' as status;
