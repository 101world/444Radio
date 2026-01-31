-- Check Desi Groove in music_library for the user who created it
SELECT 
  id,
  clerk_user_id,
  title,
  prompt,
  audio_url,
  created_at
FROM music_library
WHERE audio_url LIKE '%Desi-Groove%'
ORDER BY created_at DESC;
