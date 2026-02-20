-- Find and remove the individual visualizer release
-- This visualizer should be attached to a song, not released separately

-- First, let's see what we have
SELECT 
  id, 
  user_id, 
  title, 
  type,
  audio_url,
  image_url,
  video_url,
  genre,
  created_at
FROM combined_media
WHERE video_url LIKE '%visualizer-user_34IkVS04YVAZH371HSr3aaZlU60-1771597879828.mp4%'
   OR audio_url LIKE '%visualizer-user_34IkVS04YVAZH371HSr3aaZlU60-1771597879828.mp4%'
   OR media_url LIKE '%visualizer-user_34IkVS04YVAZH371HSr3aaZlU60-1771597879828.mp4%'
ORDER BY created_at DESC;

-- Find releases from this user for context
SELECT 
  id, 
  user_id, 
  title, 
  type,
  genre,
  CASE 
    WHEN audio_url LIKE '%visualizer%' THEN 'HAS VISUALIZER AUDIO'
    ELSE LEFT(audio_url, 50)
  END as audio_preview,
  CASE 
    WHEN video_url LIKE '%visualizer%' THEN 'HAS VISUALIZER VIDEO'
    ELSE LEFT(video_url, 50)
  END as video_preview,
  created_at
FROM combined_media
WHERE user_id = 'user_34IkVS04YVAZH371HSr3aaZlU60'
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================
-- DELETE COMMAND (run after verifying above)
-- ============================================================
-- Delete the individual visualizer entry (NOT the song with visualizer attached)
-- We want to keep the proper release (song + visualizer) and delete the standalone visualizer

-- This will delete entries where:
-- 1. The video_url OR audio_url OR media_url contains the visualizer filename
-- 2. The genre is 'visualizer' (standalone visualizer) OR type is 'video' with no actual audio
-- 3. It's a standalone release (no real audio_url pointing to actual music)

/*
DELETE FROM combined_media
WHERE user_id = 'user_34IkVS04YVAZH371HSr3aaZlU60'
  AND (
    video_url LIKE '%visualizer-user_34IkVS04YVAZH371HSr3aaZlU60-1771597879828.mp4%'
    OR audio_url LIKE '%visualizer-user_34IkVS04YVAZH371HSr3aaZlU60-1771597879828.mp4%'
    OR media_url LIKE '%visualizer-user_34IkVS04YVAZH371HSr3aaZlU60-1771597879828.mp4%'
  )
  AND (
    genre = 'visualizer'  -- Standalone visualizer genre
    OR (type = 'video' AND title LIKE 'Visualizer:%')  -- Standalone visualizer type
  );
*/

-- Note: Keep this command commented until you review the SELECT results above
-- to make sure we're only deleting the individual visualizer, not the combined song+video release
