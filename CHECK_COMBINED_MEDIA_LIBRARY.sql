-- Check if there's a combined_media_library table with the missing songs
SELECT 
  'combined_media_library' as table_name,
  COUNT(*) as song_count
FROM combined_media_library
WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
   OR user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R';

-- Show all songs from combined_media_library for 101world
SELECT id, clerk_user_id, user_id, title, audio_url, created_at
FROM combined_media_library
WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
   OR user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
ORDER BY created_at DESC;
