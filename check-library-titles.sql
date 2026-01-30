-- Check actual titles in music_library vs combined_media
SELECT 
  ml.id,
  ml.title as music_library_title,
  ml.music_url,
  ml.created_at
FROM music_library ml
WHERE ml.clerk_user_id = (SELECT clerk_user_id FROM users WHERE username = '101world' LIMIT 1)
ORDER BY ml.created_at DESC
LIMIT 10;

-- Also check combined_media
SELECT 
  cm.id,
  cm.title as combined_media_title,
  cm.audio_url,
  cm.created_at
FROM combined_media cm
WHERE cm.user_id = (SELECT clerk_user_id FROM users WHERE username = '101world' LIMIT 1)
ORDER BY cm.created_at DESC
LIMIT 10;
