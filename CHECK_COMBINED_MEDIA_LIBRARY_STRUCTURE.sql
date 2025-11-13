-- Check structure of combined_media_library
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'combined_media_library' 
ORDER BY ordinal_position;

-- Count total rows
SELECT COUNT(*) as total_rows FROM combined_media_library;

-- Show all data for 101world (just using clerk_user_id)
SELECT *
FROM combined_media_library
WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
ORDER BY created_at DESC;

-- Show sample data to understand the structure
SELECT * FROM combined_media_library LIMIT 10;
