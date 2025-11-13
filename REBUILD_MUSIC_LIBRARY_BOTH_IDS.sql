-- ========================================
-- COMPLETE MUSIC_LIBRARY REBUILD
-- Populates music_library from combined_media with BOTH user_id formats
-- ========================================

-- Step 1: Add user_id column if it doesn't exist
ALTER TABLE music_library ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Step 2: Clear music_library and start fresh
TRUNCATE music_library CASCADE;

-- Step 3: Insert ALL songs from combined_media (INCLUDING nulls to get everything)
-- This will populate BOTH clerk_user_id AND user_id columns
INSERT INTO music_library (
  clerk_user_id,
  user_id,
  title,
  prompt,
  lyrics,
  audio_url,
  duration,
  audio_format,
  status,
  created_at,
  updated_at
)
SELECT DISTINCT ON (audio_url)
  COALESCE(user_id, 'unknown') as clerk_user_id,  -- Save to clerk_user_id
  COALESCE(user_id, 'unknown') as user_id,         -- ALSO save to user_id (same value)
  COALESCE(title, 'Untitled'),
  COALESCE(audio_prompt, 'Generated music'),
  lyrics,
  audio_url,
  duration,
  'mp3',
  'ready',
  created_at,
  COALESCE(updated_at, created_at)
FROM combined_media
WHERE audio_url IS NOT NULL
ORDER BY audio_url, created_at DESC;

-- Step 4: Create indexes on BOTH columns
CREATE INDEX IF NOT EXISTS idx_music_library_clerk_user_id ON music_library(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_music_library_user_id ON music_library(user_id);

-- Step 5: Show results
SELECT 'Total songs in music_library:' as metric, COUNT(*) as count FROM music_library;

SELECT 'Songs per user (clerk_user_id):' as metric;
SELECT clerk_user_id, COUNT(*) as songs
FROM music_library
GROUP BY clerk_user_id
ORDER BY songs DESC
LIMIT 10;

SELECT 'Songs per user (user_id):' as metric;
SELECT user_id, COUNT(*) as songs
FROM music_library
GROUP BY user_id
ORDER BY songs DESC
LIMIT 10;

-- Step 6: Verify columns exist
SELECT 'Columns in music_library:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'music_library'
AND column_name IN ('clerk_user_id', 'user_id')
ORDER BY column_name;

SELECT '✅ COMPLETE! music_library now has data in BOTH clerk_user_id AND user_id columns' as final_status;
