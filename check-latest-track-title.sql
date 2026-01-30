-- Check the most recent track in music_library to see what title is stored
SELECT 
  id,
  title,
  prompt,
  audio_url,
  created_at
FROM music_library
WHERE clerk_user_id = (SELECT clerk_user_id FROM users WHERE username = '101world' LIMIT 1)
ORDER BY created_at DESC
LIMIT 5;
