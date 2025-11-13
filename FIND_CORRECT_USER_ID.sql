-- Find ALL user IDs in combined_media
SELECT DISTINCT user_id, COUNT(*) as songs
FROM combined_media
WHERE audio_url IS NOT NULL
GROUP BY user_id
ORDER BY songs DESC
LIMIT 20;

-- Check what's in music_library
SELECT DISTINCT clerk_user_id, COUNT(*) as songs
FROM music_library
GROUP BY clerk_user_id
ORDER BY songs DESC
LIMIT 20;

-- Show sample combined_media records to see user_id format
SELECT id, user_id, title, audio_url, created_at
FROM combined_media
WHERE audio_url IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
