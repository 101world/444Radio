-- Diagnostic: Check what's actually in the database

-- 1. Total tracks and is_public distribution
SELECT 
  COUNT(*) as total_tracks,
  COUNT(*) FILTER (WHERE is_public = true) as is_public_true,
  COUNT(*) FILTER (WHERE is_public = false) as is_public_false,
  COUNT(*) FILTER (WHERE is_public IS NULL) as is_public_null
FROM combined_media;

-- 2. Show sample tracks with is_public status
SELECT 
  id,
  title,
  user_id,
  is_public,
  audio_url IS NOT NULL as has_audio,
  image_url IS NOT NULL as has_image,
  created_at
FROM combined_media
ORDER BY created_at DESC
LIMIT 30;

-- 3. Count tracks per user
SELECT 
  user_id,
  COUNT(*) as track_count,
  COUNT(*) FILTER (WHERE is_public = true) as public_tracks,
  COUNT(*) FILTER (WHERE is_public IS NULL) as null_tracks
FROM combined_media
GROUP BY user_id
ORDER BY track_count DESC
LIMIT 10;

-- 4. Check if there are tracks with missing audio/image URLs
SELECT 
  COUNT(*) as tracks_missing_urls,
  COUNT(*) FILTER (WHERE audio_url IS NULL) as missing_audio,
  COUNT(*) FILTER (WHERE image_url IS NULL) as missing_image
FROM combined_media;
