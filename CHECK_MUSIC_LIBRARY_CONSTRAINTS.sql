-- Check for constraints and indexes on music_library that might block inserts
SELECT 
  'Constraints on music_library' as info,
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'music_library'::regclass;

-- Check for unique indexes
SELECT 
  'Indexes on music_library' as info,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'music_library';

-- Check for duplicate audio_urls in music_library
SELECT 
  'Duplicate audio_urls in music_library' as info,
  audio_url,
  COUNT(*) as duplicate_count
FROM music_library
GROUP BY audio_url
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Check total count
SELECT 
  'Total rows in music_library' as info,
  COUNT(*) as total_count
FROM music_library;

-- Check if there's a unique constraint on audio_url
SELECT 
  'Check unique constraint on audio_url' as info,
  COUNT(*) as constraint_count
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu 
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'music_library' 
  AND ccu.column_name = 'audio_url'
  AND tc.constraint_type = 'UNIQUE';
