-- Test 1: Check if function exists
SELECT 
  routine_name,
  routine_type,
  data_type as return_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'increment_play_count';

-- Test 2: Try to call the function manually on a test track
-- Replace 'your-track-id-here' with an actual track ID from your database
SELECT increment_play_count('3c29a037-0c64-44dc-bc7b-8fe4c0ee2a5d'::uuid);

-- Test 3: Check the plays count after
SELECT id, title, plays 
FROM combined_media 
WHERE id = '3c29a037-0c64-44dc-bc7b-8fe4c0ee2a5d';

-- Test 4: Check RLS policies on combined_media
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'combined_media';
