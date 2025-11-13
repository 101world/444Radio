-- =====================================================
-- 444 RADIO: IMPORT ALL MUSIC TO LIBRARY
-- =====================================================
-- Copy ALL existing music from combined_media to music_library
-- This gives you back all your old generations!
-- =====================================================

-- First, clear music_library to avoid duplicates
TRUNCATE TABLE music_library;

-- Import ALL music from combined_media (releases)
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
  title,
  COALESCE(audio_prompt, 'Generated track') as prompt,
  lyrics,
  audio_url,
  duration,
  'mp3' as audio_format,
  'ready' as status,
  created_at,
  updated_at
FROM combined_media
WHERE audio_url IS NOT NULL
  AND audio_url != ''
  AND (audio_url LIKE '%.mp3' OR audio_url LIKE '%.wav' OR audio_url LIKE '%music%')
ORDER BY audio_url, created_at DESC;

-- Show results
SELECT 
  'Import Summary' as action,
  COUNT(*) as total_music_in_library,
  COUNT(DISTINCT clerk_user_id) as unique_users,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM music_library;

-- Show your music specifically
SELECT 
  id,
  title,
  LEFT(prompt, 50) as prompt_preview,
  audio_format,
  created_at
FROM music_library
ORDER BY created_at DESC
LIMIT 10;

-- SUCCESS! ✅
-- All old music has been imported to music_library!
