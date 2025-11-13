-- Find the 6 missing songs (in combined_media but not in music_library)
SELECT 
  cm.id,
  cm.user_id,
  cm.title,
  cm.audio_url,
  cm.created_at,
  'MISSING from music_library' as status
FROM combined_media cm
WHERE cm.audio_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM music_library ml 
    WHERE ml.audio_url = cm.audio_url
  )
ORDER BY cm.created_at DESC;
