-- =====================================================
-- 444 RADIO: MUSIC LIBRARY TABLE (CLEAN VERSION)
-- =====================================================
-- Run this ONLY ONCE to create music_library table
-- =====================================================

-- Drop the old table completely (WARNING: This deletes all data!)
DROP TABLE IF EXISTS music_library CASCADE;

-- Create music_library table with correct structure
CREATE TABLE music_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL,
  
  -- Music details
  title TEXT,
  prompt TEXT NOT NULL,
  lyrics TEXT,
  audio_url TEXT NOT NULL,
  
  -- Metadata
  duration INTEGER,
  file_size BIGINT,
  audio_format TEXT DEFAULT 'mp3',
  bitrate INTEGER DEFAULT 256000,
  sample_rate INTEGER DEFAULT 44100,
  
  -- Generation tracking
  replicate_id TEXT,
  replicate_version TEXT,
  generation_params JSONB,
  
  -- Status
  status TEXT DEFAULT 'ready',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_music_library_user ON music_library(clerk_user_id);
CREATE INDEX idx_music_library_created ON music_library(created_at DESC);
CREATE INDEX idx_music_library_status ON music_library(status);

-- Enable RLS (but allow all since API uses service role key)
ALTER TABLE music_library ENABLE ROW LEVEL SECURITY;

-- Create permissive policies
CREATE POLICY "Allow all for service role" 
  ON music_library 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Add comments
COMMENT ON TABLE music_library IS 'Stores all AI-generated music files';
COMMENT ON COLUMN music_library.clerk_user_id IS 'Clerk user ID who generated this music';
COMMENT ON COLUMN music_library.audio_url IS 'Permanent R2 URL for the audio file';

-- Verify table was created
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'music_library'
ORDER BY ordinal_position;

-- Check that table exists and is empty
SELECT COUNT(*) as total_records FROM music_library;

-- SUCCESS! ✅
-- Table created. Now generate some music to test!
