-- Check which user IDs have songs
SELECT 
  user_id,
  COUNT(*) as song_count,
  MIN(created_at) as first_song,
  MAX(created_at) as last_song
FROM combined_media
WHERE audio_url IS NOT NULL
GROUP BY user_id
ORDER BY song_count DESC;

-- Show sample songs per user
SELECT user_id, title, audio_url, created_at
FROM combined_media
WHERE audio_url IS NOT NULL
ORDER BY user_id, created_at DESC
LIMIT 50;
