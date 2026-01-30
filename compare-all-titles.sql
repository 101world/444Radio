-- Compare titles across all 3 music tables for 101world user
WITH user_id AS (
  SELECT clerk_user_id FROM users WHERE username = '101world' LIMIT 1
)

-- Music Library (the source of truth)
SELECT 
  'music_library' as source_table,
  id, 
  title, 
  audio_url, 
  created_at
FROM music_library
WHERE clerk_user_id = (SELECT clerk_user_id FROM user_id)
ORDER BY created_at DESC
LIMIT 5

UNION ALL

-- Combined Media Library (for pre-release tracks)
SELECT 
  'combined_media_library' as source_table,
  id::text as id,
  title, 
  audio_url, 
  created_at
FROM combined_media_library
WHERE clerk_user_id = (SELECT clerk_user_id FROM user_id)
ORDER BY created_at DESC
LIMIT 5

UNION ALL

-- Combined Media (public releases on Explore)
SELECT 
  'combined_media' as source_table,
  id::text as id,
  title, 
  audio_url, 
  created_at
FROM combined_media
WHERE user_id = (SELECT clerk_user_id FROM user_id)
  AND type = 'audio'
ORDER BY created_at DESC
LIMIT 5

ORDER BY created_at DESC;
