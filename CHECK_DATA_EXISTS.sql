-- Verify data still exists in combined_media
SELECT 
  'combined_media count' as table_name,
  COUNT(*) as total_songs,
  COUNT(DISTINCT user_id) as unique_users
FROM combined_media
WHERE audio_url IS NOT NULL;

-- Check music_library
SELECT 
  'music_library count' as table_name,
  COUNT(*) as total_songs,
  COUNT(DISTINCT clerk_user_id) as unique_clerk_ids,
  COUNT(DISTINCT user_id) as unique_user_ids
FROM music_library;

-- Show recent songs from combined_media
SELECT 
  'Recent songs in combined_media' as info,
  user_id,
  title,
  audio_url,
  created_at
FROM combined_media
WHERE audio_url IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- Show what's in music_library
SELECT 
  'Recent songs in music_library' as info,
  clerk_user_id,
  user_id,
  title,
  audio_url,
  created_at
FROM music_library
ORDER BY created_at DESC
LIMIT 10;
