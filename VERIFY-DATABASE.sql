-- Run this to verify the SQL update worked
SELECT 
  COUNT(*) as total_tracks,
  COUNT(*) FILTER (WHERE is_public = true) as is_public_true,
  COUNT(*) FILTER (WHERE is_public = false) as is_public_false,
  COUNT(*) FILTER (WHERE is_public IS NULL) as is_public_null,
  COUNT(*) FILTER (WHERE audio_url IS NOT NULL AND image_url IS NOT NULL) as valid_tracks
FROM combined_media;

-- Show recent tracks to verify they exist
SELECT 
  id,
  title,
  is_public,
  audio_url IS NOT NULL as has_audio,
  image_url IS NOT NULL as has_image,
  created_at
FROM combined_media
ORDER BY created_at DESC
LIMIT 50;
