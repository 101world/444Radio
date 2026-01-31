-- Check title column definition in all tables
SELECT 
  table_name,
  column_name,
  data_type,
  character_maximum_length
FROM information_schema.columns
WHERE column_name = 'title'
  AND table_name IN ('music_library', 'combined_media', 'combined_media_library')
ORDER BY table_name;
