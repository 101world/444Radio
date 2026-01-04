-- Check all genres and their track counts
SELECT 
  genre,
  COUNT(*) as track_count
FROM combined_media
WHERE genre IS NOT NULL AND genre != ''
GROUP BY genre
ORDER BY track_count DESC;

-- Check sample of all tracks with genre info
SELECT 
  id,
  title,
  genre,
  users.username as artist,
  created_at
FROM combined_media
LEFT JOIN users ON combined_media.user_id = users.clerk_user_id
ORDER BY created_at DESC
LIMIT 20;

-- Check if there are tracks without genres
SELECT 
  COUNT(*) as tracks_without_genre
FROM combined_media
WHERE genre IS NULL OR genre = '';

-- Check total tracks
SELECT COUNT(*) as total_tracks FROM combined_media;
