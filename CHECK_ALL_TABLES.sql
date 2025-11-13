-- Check ALL tables for audio files
SELECT 'combined_media' as table_name, COUNT(*) as song_count
FROM combined_media
WHERE audio_url IS NOT NULL;

SELECT 'music_library' as table_name, COUNT(*) as song_count
FROM music_library;

SELECT 'songs' as table_name, COUNT(*) as song_count
FROM songs
WHERE audio_url IS NOT NULL;

-- Show sample from each table
SELECT 'Sample from combined_media' as info;
SELECT id, user_id, title, audio_url, created_at
FROM combined_media
WHERE audio_url IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

SELECT 'Sample from music_library' as info;
SELECT id, clerk_user_id, user_id, title, audio_url, created_at
FROM music_library
ORDER BY created_at DESC
LIMIT 5;

SELECT 'Sample from songs table' as info;
SELECT id, user_id, prompt, audio_url, created_at
FROM songs
WHERE audio_url IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
