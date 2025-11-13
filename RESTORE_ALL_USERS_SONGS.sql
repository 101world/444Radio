-- Restore ALL songs for ALL users
TRUNCATE music_library CASCADE;

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

-- Show results per user
SELECT clerk_user_id, COUNT(*) as songs
FROM music_library
GROUP BY clerk_user_id
ORDER BY songs DESC;

SELECT 'Total songs restored:' as result, COUNT(*) as count FROM music_library;
