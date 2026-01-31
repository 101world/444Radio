-- Check if "Dharmic Duty" is in combined_media and compare titles
SELECT 
  'music_library' as source,
  id::text,
  title,
  audio_url,
  created_at
FROM music_library
WHERE audio_url LIKE '%Dharmic-Duty%'

UNION ALL

SELECT 
  'combined_media' as source,
  id::text,
  title,
  audio_url,
  created_at
FROM combined_media
WHERE audio_url LIKE '%Dharmic-Duty%'

ORDER BY source, created_at DESC;
