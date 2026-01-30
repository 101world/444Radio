-- Find "Desi Groove" track across all tables
SELECT 'music_library' as source, id::text, title, audio_url, created_at
FROM music_library
WHERE audio_url LIKE '%Desi-Groove%'

UNION ALL

SELECT 'combined_media_library' as source, id::text, title, audio_url, created_at
FROM combined_media_library
WHERE audio_url LIKE '%Desi-Groove%'

UNION ALL

SELECT 'combined_media' as source, id::text, title, audio_url, created_at
FROM combined_media
WHERE audio_url LIKE '%Desi-Groove%'

ORDER BY created_at DESC;
