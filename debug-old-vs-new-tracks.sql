-- Check newest 10 tracks
SELECT 
  id, 
  title, 
  COALESCE(plays, 0) as plays, 
  created_at,
  LEFT(user_id, 20) as user_id_prefix
FROM combined_media 
ORDER BY created_at DESC 
LIMIT 10;

-- Check oldest 10 tracks that have plays > 0
SELECT 
  id, 
  title, 
  plays, 
  created_at,
  LEFT(user_id, 20) as user_id_prefix
FROM combined_media 
WHERE plays > 0 
ORDER BY created_at ASC 
LIMIT 10;

-- Compare column structure for old vs new tracks
SELECT 
  CASE 
    WHEN created_at < '2026-01-24' THEN 'OLD'
    ELSE 'NEW'
  END as track_age,
  COUNT(*) as total_tracks,
  SUM(CASE WHEN plays > 0 THEN 1 ELSE 0 END) as tracks_with_plays,
  SUM(COALESCE(plays, 0)) as total_plays
FROM combined_media
GROUP BY track_age
ORDER BY track_age;

-- Check if there's a difference in user_id format
SELECT 
  CASE 
    WHEN created_at < '2026-01-24' THEN 'OLD'
    ELSE 'NEW'
  END as track_age,
  user_id,
  title,
  plays,
  created_at
FROM combined_media
ORDER BY created_at ASC
LIMIT 5;
