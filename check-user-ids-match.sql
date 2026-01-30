-- Check if both records belong to the same user (101world)
SELECT 
  '101world user_id' as check_type,
  clerk_user_id 
FROM users 
WHERE username = '101world'

UNION ALL

SELECT 
  'music_library user' as check_type,
  clerk_user_id
FROM music_library
WHERE id = '2b5c281c-528b-49be-ba7f-05889b79cb4e'

UNION ALL

SELECT 
  'combined_media user' as check_type,
  user_id
FROM combined_media
WHERE id = 'a4a919d0-3d0d-4de4-8372-7238abef8a87';
