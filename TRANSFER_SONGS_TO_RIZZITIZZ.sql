-- ==========================================
-- TRANSFER SONGS FROM 101world TO rizzitizz
-- Run this in Supabase SQL Editor
-- ==========================================

-- From: user_34J8MP3KCfczODGn9yKMolWPX9R (101world)
-- To: user_34IRTbbo6kCHjWMZvXYTBWepAtw (rizzitizz)

BEGIN;

-- Update combined_media (uses user_id column)
UPDATE combined_media 
SET user_id = 'user_34IRTbbo6kCHjWMZvXYTBWepAtw'
WHERE user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R';

-- Update combined_media_library (uses clerk_user_id column)
UPDATE combined_media_library 
SET clerk_user_id = 'user_34IRTbbo6kCHjWMZvXYTBWepAtw'
WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R';

-- Update music_library (uses clerk_user_id column)
UPDATE music_library 
SET clerk_user_id = 'user_34IRTbbo6kCHjWMZvXYTBWepAtw'
WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R';

-- Show results
SELECT 'combined_media' as table_name, COUNT(*) as transferred
FROM combined_media 
WHERE user_id = 'user_34IRTbbo6kCHjWMZvXYTBWepAtw' AND audio_url IS NOT NULL

UNION ALL

SELECT 'combined_media_library', COUNT(*)
FROM combined_media_library 
WHERE clerk_user_id = 'user_34IRTbbo6kCHjWMZvXYTBWepAtw'

UNION ALL

SELECT 'music_library', COUNT(*)
FROM music_library 
WHERE clerk_user_id = 'user_34IRTbbo6kCHjWMZvXYTBWepAtw'

UNION ALL

SELECT '🎵 TOTAL UNIQUE', COUNT(DISTINCT audio_url)
FROM (
  SELECT audio_url FROM combined_media WHERE user_id = 'user_34IRTbbo6kCHjWMZvXYTBWepAtw' AND audio_url IS NOT NULL
  UNION
  SELECT audio_url FROM combined_media_library WHERE clerk_user_id = 'user_34IRTbbo6kCHjWMZvXYTBWepAtw'
  UNION
  SELECT audio_url FROM music_library WHERE clerk_user_id = 'user_34IRTbbo6kCHjWMZvXYTBWepAtw'
) all_songs;

COMMIT;
