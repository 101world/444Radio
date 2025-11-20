-- Clean up expired Replicate URLs from database
-- Replicate URLs expire after 24-48 hours, so any track > 48 hours old with replicate.delivery URL is broken

-- 1. Find tracks with expired Replicate URLs in songs table
SELECT 
  id,
  prompt,
  user_id,
  audio_url,
  cover_url,
  status,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as hours_old
FROM songs
WHERE 
  (audio_url LIKE '%replicate.delivery%' OR cover_url LIKE '%replicate.delivery%')
  AND created_at < NOW() - INTERVAL '48 hours'
  AND status = 'complete'
ORDER BY created_at DESC;

-- 2. DELETE songs with expired Replicate audio URLs (older than 48 hours)
-- Uncomment to actually delete:
-- DELETE FROM songs
-- WHERE audio_url LIKE '%replicate.delivery%' 
--   AND created_at < NOW() - INTERVAL '48 hours'
--   AND status = 'complete';

-- 3. Find tracks with expired URLs in combined_media table
SELECT 
  id,
  title,
  user_id,
  username,
  audio_url,
  image_url,
  is_public,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as hours_old
FROM combined_media
WHERE 
  (audio_url LIKE '%replicate.delivery%' OR image_url LIKE '%replicate.delivery%')
  AND created_at < NOW() - INTERVAL '48 hours'
ORDER BY created_at DESC;

-- 4. DELETE combined_media with expired Replicate URLs
-- Uncomment to actually delete:
-- DELETE FROM combined_media
-- WHERE audio_url LIKE '%replicate.delivery%' 
--   AND created_at < NOW() - INTERVAL '48 hours';

-- 5. Find tracks with expired URLs in music_library table  
SELECT 
  id,
  title,
  clerk_user_id,
  audio_url,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as hours_old
FROM music_library
WHERE 
  audio_url LIKE '%replicate.delivery%'
  AND created_at < NOW() - INTERVAL '48 hours'
ORDER BY created_at DESC;

-- 6. DELETE music_library with expired Replicate URLs
-- Uncomment to actually delete:
-- DELETE FROM music_library
-- WHERE audio_url LIKE '%replicate.delivery%' 
--   AND created_at < NOW() - INTERVAL '48 hours';

-- 7. Summary of cleanup
SELECT 
  'songs' as table_name,
  COUNT(*) as expired_tracks
FROM songs
WHERE audio_url LIKE '%replicate.delivery%' 
  AND created_at < NOW() - INTERVAL '48 hours'
UNION ALL
SELECT 
  'combined_media',
  COUNT(*)
FROM combined_media
WHERE audio_url LIKE '%replicate.delivery%' 
  AND created_at < NOW() - INTERVAL '48 hours'
UNION ALL
SELECT 
  'music_library',
  COUNT(*)
FROM music_library
WHERE audio_url LIKE '%replicate.delivery%' 
  AND created_at < NOW() - INTERVAL '48 hours';
