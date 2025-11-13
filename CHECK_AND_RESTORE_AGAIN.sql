-- Check current state of music_library
SELECT clerk_user_id, COUNT(*) as songs
FROM music_library
GROUP BY clerk_user_id
ORDER BY songs DESC;

-- If count is low, restore again
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
  AND NOT EXISTS (
    SELECT 1 FROM music_library ml
    WHERE ml.audio_url = combined_media.audio_url
  )
ORDER BY audio_url, created_at DESC;

-- Show final count
SELECT clerk_user_id, COUNT(*) as songs
FROM music_library
GROUP BY clerk_user_id
ORDER BY songs DESC;
