-- Just show counts from each table
SELECT 
  'combined_media' as table_name, 
  COUNT(*) as total_songs
FROM combined_media
WHERE audio_url IS NOT NULL

UNION ALL

SELECT 
  'music_library' as table_name,
  COUNT(*) as total_songs
FROM music_library

UNION ALL

SELECT 
  'songs' as table_name,
  COUNT(*) as total_songs
FROM songs
WHERE audio_url IS NOT NULL;
