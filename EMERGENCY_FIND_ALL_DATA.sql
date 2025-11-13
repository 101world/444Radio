-- ========================================
-- EMERGENCY: FIND ALL TABLES AND MUSIC DATA
-- This will show us EVERY table in the database
-- ========================================

-- Step 1: List ALL tables in the database
SELECT 'ALL TABLES IN DATABASE:' as info;
SELECT 
  table_schema,
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Step 2: Check if 'songs' table exists and has data
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'songs') THEN
    RAISE NOTICE 'songs table EXISTS!';
  ELSE
    RAISE NOTICE 'songs table does NOT exist';
  END IF;
END $$;

-- Step 3: Try to query songs table (will error if doesn't exist - that's OK)
SELECT 'Checking songs table:' as info;
SELECT COUNT(*) as count FROM songs;
SELECT user_id, COUNT(*) as song_count FROM songs GROUP BY user_id ORDER BY song_count DESC LIMIT 10;

-- Step 4: Show columns in combined_media to understand structure
SELECT 'Columns in combined_media:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'combined_media' 
ORDER BY ordinal_position;

-- Step 5: Check for any other media/audio related tables
SELECT 'Tables with media/audio/music keywords:' as info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
AND (
  table_name ILIKE '%music%' 
  OR table_name ILIKE '%song%' 
  OR table_name ILIKE '%audio%'
  OR table_name ILIKE '%media%'
  OR table_name ILIKE '%track%'
  OR table_name ILIKE '%library%'
  OR table_name ILIKE '%upload%'
)
ORDER BY table_name;

-- Step 6: Count records in each relevant table
SELECT 'music_library:' as table_name, COUNT(*) as count FROM music_library;
SELECT 'images_library:' as table_name, COUNT(*) as count FROM images_library;
SELECT 'combined_media:' as table_name, COUNT(*) as count FROM combined_media;
SELECT 'combined_media (audio):' as table_name, COUNT(*) as count FROM combined_media WHERE audio_url IS NOT NULL;
SELECT 'combined_media (images):' as table_name, COUNT(*) as count FROM combined_media WHERE image_url IS NOT NULL;
SELECT 'combined_media (both):' as table_name, COUNT(*) as count FROM combined_media WHERE audio_url IS NOT NULL AND image_url IS NOT NULL;

-- Step 7: Show OLDEST records in combined_media to see if old data exists
SELECT 'OLDEST combined_media records:' as info;
SELECT id, user_id, title, audio_url, image_url, created_at 
FROM combined_media 
ORDER BY created_at ASC 
LIMIT 20;

-- Step 8: Show NEWEST records in combined_media
SELECT 'NEWEST combined_media records:' as info;
SELECT id, user_id, title, audio_url, image_url, created_at 
FROM combined_media 
ORDER BY created_at DESC 
LIMIT 20;
