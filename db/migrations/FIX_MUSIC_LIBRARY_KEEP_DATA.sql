-- =====================================================
-- 444 RADIO: FIX MUSIC LIBRARY (PRESERVE DATA)
-- =====================================================
-- This renames user_id to clerk_user_id WITHOUT losing data
-- =====================================================

-- Step 1: Check if the column is called user_id
DO $$
BEGIN
  -- If user_id exists, rename it to clerk_user_id
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'music_library' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE music_library RENAME COLUMN user_id TO clerk_user_id;
    RAISE NOTICE 'Renamed user_id to clerk_user_id';
  ELSE
    RAISE NOTICE 'Column already named clerk_user_id or table does not exist';
  END IF;
END $$;

-- Step 2: Ensure all columns exist (add missing ones)
ALTER TABLE music_library ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE music_library ADD COLUMN IF NOT EXISTS prompt TEXT;
ALTER TABLE music_library ADD COLUMN IF NOT EXISTS lyrics TEXT;
ALTER TABLE music_library ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE music_library ADD COLUMN IF NOT EXISTS duration INTEGER;
ALTER TABLE music_library ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE music_library ADD COLUMN IF NOT EXISTS audio_format TEXT DEFAULT 'mp3';
ALTER TABLE music_library ADD COLUMN IF NOT EXISTS bitrate INTEGER DEFAULT 256000;
ALTER TABLE music_library ADD COLUMN IF NOT EXISTS sample_rate INTEGER DEFAULT 44100;
ALTER TABLE music_library ADD COLUMN IF NOT EXISTS replicate_id TEXT;
ALTER TABLE music_library ADD COLUMN IF NOT EXISTS replicate_version TEXT;
ALTER TABLE music_library ADD COLUMN IF NOT EXISTS generation_params JSONB;
ALTER TABLE music_library ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ready';
ALTER TABLE music_library ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE music_library ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Step 3: Make required columns NOT NULL (if they aren't already)
DO $$
BEGIN
  -- Only set NOT NULL if column doesn't already have it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'music_library' 
    AND column_name = 'clerk_user_id' 
    AND is_nullable = 'YES'
  ) THEN
    -- First, fill any NULL values with a placeholder
    UPDATE music_library SET clerk_user_id = 'unknown' WHERE clerk_user_id IS NULL;
    -- Then set NOT NULL
    ALTER TABLE music_library ALTER COLUMN clerk_user_id SET NOT NULL;
  END IF;
END $$;

-- Step 4: Recreate indexes (drop old ones first)
DROP INDEX IF EXISTS idx_music_library_user;
DROP INDEX IF EXISTS idx_music_library_created;
DROP INDEX IF EXISTS idx_music_library_status;

CREATE INDEX idx_music_library_user ON music_library(clerk_user_id);
CREATE INDEX idx_music_library_created ON music_library(created_at DESC);
CREATE INDEX idx_music_library_status ON music_library(status);

-- Step 5: Enable RLS if not already enabled
ALTER TABLE music_library ENABLE ROW LEVEL SECURITY;

-- Step 6: Drop old policies and create new ones
DROP POLICY IF EXISTS "Users can view own music" ON music_library;
DROP POLICY IF EXISTS "Users can insert own music" ON music_library;
DROP POLICY IF EXISTS "Users can update own music" ON music_library;
DROP POLICY IF EXISTS "Users can delete own music" ON music_library;
DROP POLICY IF EXISTS "Allow all for service role" ON music_library;

CREATE POLICY "Allow all for service role" 
  ON music_library 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Step 7: Update comments
COMMENT ON TABLE music_library IS 'Stores all AI-generated music files';
COMMENT ON COLUMN music_library.clerk_user_id IS 'Clerk user ID who generated this music';
COMMENT ON COLUMN music_library.audio_url IS 'Permanent R2 URL for the audio file';

-- Step 8: Show results
SELECT 
  'music_library' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT clerk_user_id) as unique_users,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record
FROM music_library;

-- Step 9: Show column structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'music_library'
ORDER BY ordinal_position;

-- SUCCESS! ✅
-- All existing data preserved, column renamed to clerk_user_id
