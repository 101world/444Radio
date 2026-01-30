-- Get the MOST RECENT track title from music_library for 101world
SELECT 
  id,
  title,
  prompt,
  audio_url,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_ago
FROM music_library
WHERE clerk_user_id = (SELECT clerk_user_id FROM users WHERE username = '101world' LIMIT 1)
ORDER BY created_at DESC
LIMIT 1;
