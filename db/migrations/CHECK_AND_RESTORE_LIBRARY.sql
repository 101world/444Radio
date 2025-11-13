-- Check current state of library tables
SELECT 'music_library count:' as check_type, COUNT(*) as count FROM music_library;
SELECT 'images_library count:' as check_type, COUNT(*) as count FROM images_library;
SELECT 'combined_media count:' as check_type, COUNT(*) as count FROM combined_media;

-- Show sample data from each table
SELECT 'Sample music_library data:' as info;
SELECT id, clerk_user_id, title, audio_url, created_at FROM music_library ORDER BY created_at DESC LIMIT 5;

SELECT 'Sample images_library data:' as info;
SELECT id, clerk_user_id, title, image_url, created_at FROM images_library ORDER BY created_at DESC LIMIT 5;

SELECT 'Sample combined_media data:' as info;
SELECT id, user_id, title, audio_url, image_url, created_at FROM combined_media ORDER BY created_at DESC LIMIT 5;

-- Check if we need to copy data from combined_media to music_library
SELECT 'Items in combined_media with audio but NOT in music_library:' as info;
SELECT COUNT(*) as missing_count
FROM combined_media cm
WHERE cm.audio_url IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM music_library ml 
  WHERE ml.audio_url = cm.audio_url
);

-- Check if we need to copy data from combined_media to images_library
SELECT 'Items in combined_media with images but NOT in images_library:' as info;
SELECT COUNT(*) as missing_count
FROM combined_media cm
WHERE cm.image_url IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM images_library il 
  WHERE il.image_url = cm.image_url
);
