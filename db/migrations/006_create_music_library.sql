-- =====================================================
-- 444 RADIO: MUSIC LIBRARY TABLE
-- =====================================================
-- Migration 006: Create music_library table to store all generated music
-- =====================================================

-- Create music_library table
CREATE TABLE IF NOT EXISTS music_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL, -- Clerk user ID
  
  -- Music details
  title TEXT,
  prompt TEXT NOT NULL,
  lyrics TEXT,
  audio_url TEXT NOT NULL, -- R2 permanent URL
  
  -- Metadata
  duration INTEGER, -- in seconds
  file_size BIGINT, -- in bytes
  audio_format TEXT DEFAULT 'mp3',
  bitrate INTEGER DEFAULT 256000,
  sample_rate INTEGER DEFAULT 44100,
  
  -- Generation parameters
  replicate_id TEXT,
  replicate_version TEXT,
  generation_params JSONB,
  
  -- Status
  status TEXT DEFAULT 'ready', -- ready, processing, failed
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_music_library_user ON music_library(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_music_library_created ON music_library(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_music_library_status ON music_library(status);

-- Enable Row Level Security
ALTER TABLE music_library ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Users can view own music" ON music_library;
DROP POLICY IF EXISTS "Users can insert own music" ON music_library;
DROP POLICY IF EXISTS "Users can update own music" ON music_library;
DROP POLICY IF EXISTS "Users can delete own music" ON music_library;

-- RLS Policies (API uses Service Role Key which bypasses these, but good for direct access)
CREATE POLICY "Users can view own music" 
  ON music_library FOR SELECT 
  USING (true); -- Allow all for now, API will handle auth

CREATE POLICY "Users can insert own music" 
  ON music_library FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can update own music" 
  ON music_library FOR UPDATE 
  USING (true);

CREATE POLICY "Users can delete own music" 
  ON music_library FOR DELETE 
  USING (true);

-- Add helpful comments
COMMENT ON TABLE music_library IS 'Stores all generated music files per user';
COMMENT ON COLUMN music_library.clerk_user_id IS 'Clerk user ID who generated this music';
COMMENT ON COLUMN music_library.audio_url IS 'Permanent R2 URL for audio file';
COMMENT ON COLUMN music_library.generation_params IS 'JSON object with genre, bpm, etc used for generation';

-- Migration complete! ✅
