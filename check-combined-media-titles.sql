-- Check titles in combined_media table for 101world user
SELECT 
  id, 
  title, 
  audio_url, 
  created_at
FROM combined_media
WHERE user_id = (SELECT clerk_user_id FROM users WHERE username = '101world' LIMIT 1)
  AND type = 'audio'
ORDER BY created_at DESC
LIMIT 10;
