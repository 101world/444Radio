-- Count by user_id to see distribution
SELECT 
  'music_library by clerk_user_id' as source,
  clerk_user_id,
  COUNT(*) as song_count
FROM music_library
GROUP BY clerk_user_id
ORDER BY song_count DESC;

-- Also check user_id column
SELECT 
  'music_library by user_id' as source,
  user_id,
  COUNT(*) as song_count
FROM music_library
GROUP BY user_id
ORDER BY song_count DESC;

-- Check combined_media distribution
SELECT 
  'combined_media by user_id' as source,
  user_id,
  COUNT(*) as song_count
FROM combined_media
WHERE audio_url IS NOT NULL
GROUP BY user_id
ORDER BY song_count DESC;
