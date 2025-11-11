-- Check tracks for a specific user
-- Replace 'USER_ID_HERE' with the actual user's clerk_user_id

-- Count total tracks
SELECT COUNT(*) as total_tracks
FROM combined_media
WHERE user_id = 'USER_ID_HERE';

-- Count public tracks
SELECT COUNT(*) as public_tracks
FROM combined_media
WHERE user_id = 'USER_ID_HERE'
AND is_public = true;

-- Show all tracks with their visibility status
SELECT 
  id,
  title,
  is_public,
  created_at,
  audio_url IS NOT NULL as has_audio,
  image_url IS NOT NULL as has_image
FROM combined_media
WHERE user_id = 'USER_ID_HERE'
ORDER BY created_at DESC;

-- Check if is_public column exists and its default value
SELECT column_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'combined_media'
AND column_name = 'is_public';
