-- Check if listed_on_earn column exists and list tracks on earn
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'combined_media' 
  AND column_name IN ('listed_on_earn', 'earn_price', 'artist_share', 'admin_share', 'downloads');

-- Count tracks listed on earn
SELECT COUNT(*) as total_listed 
FROM combined_media 
WHERE listed_on_earn = true;

-- Show first 5 tracks listed on earn
SELECT 
  id,
  title,
  user_id,
  listed_on_earn,
  earn_price,
  artist_share,
  admin_share,
  downloads,
  created_at
FROM combined_media 
WHERE listed_on_earn = true
ORDER BY created_at DESC
LIMIT 5;

-- Check all tracks (if listed_on_earn column doesn't exist yet)
SELECT COUNT(*) as total_tracks FROM combined_media WHERE is_public = true;
