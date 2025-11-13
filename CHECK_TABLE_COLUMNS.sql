-- Check what columns exist in each table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'combined_media' 
ORDER BY ordinal_position;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'combined_media_library' 
ORDER BY ordinal_position;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'music_library' 
ORDER BY ordinal_position;
