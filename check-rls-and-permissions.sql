-- Check function permissions
SELECT 
  routine_name,
  routine_type,
  security_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'increment_play_count';

-- Check if function has SECURITY DEFINER (should bypass RLS)
SELECT 
  proname as function_name,
  prosecdef as is_security_definer
FROM pg_proc
WHERE proname = 'increment_play_count';

-- Check RLS policies on combined_media table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'combined_media';

-- Check if RLS is enabled on combined_media
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'combined_media';

-- Test manual increment (this will show if permissions work)
-- Use one of your track IDs
SELECT increment_play_count('3c29a037-0c64-44dc-bc7b-8fe4c0ee2a5d'::uuid) as new_play_count;

-- Verify the increment worked
SELECT id, title, plays 
FROM combined_media 
WHERE id = '3c29a037-0c64-44dc-bc7b-8fe4c0ee2a5d';
