-- Check what follower-related columns exist in users table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'users'
  AND column_name LIKE '%follow%'
ORDER BY column_name;
