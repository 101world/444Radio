-- Show which user_ids are in the 17 songs currently in music_library
SELECT 
  clerk_user_id,
  user_id,
  COUNT(*) as song_count,
  STRING_AGG(title, ', ' ORDER BY created_at DESC) as titles
FROM music_library
GROUP BY clerk_user_id, user_id
ORDER BY song_count DESC;

-- Show specifically 101world's songs in music_library
SELECT id, clerk_user_id, user_id, title, audio_url, created_at
FROM music_library
WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
   OR user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
ORDER BY created_at DESC;
