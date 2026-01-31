-- Check if increment_play_count function exists in database
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%play%'
ORDER BY routine_name;

-- Check combined_media table structure for plays column
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'combined_media'
  AND column_name = 'plays';

-- Test: Check current play counts
SELECT 
  id,
  title,
  plays,
  user_id,
  created_at
FROM combined_media
WHERE audio_url IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
