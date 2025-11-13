-- Check songs table for 101world's data
SELECT COUNT(*) as total_songs
FROM songs
WHERE user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R';

-- Show all songs for 101world from songs table
SELECT id, user_id, prompt, audio_url, created_at
FROM songs
WHERE user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'
ORDER BY created_at DESC;

-- Also check if there's a different user_id format
SELECT DISTINCT user_id
FROM songs
WHERE user_id ILIKE '%world%' OR user_id ILIKE '%101%';
