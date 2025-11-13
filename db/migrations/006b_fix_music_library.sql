-- =====================================================
-- 444 RADIO: FIX MUSIC LIBRARY TABLE
-- =====================================================
-- Migration 006b: Fix music_library table column name
-- =====================================================

-- Drop the table if it exists (safe since it's new and probably empty)
DROP TABLE IF EXISTS music_library CASCADE;

-- Create music_library table with correct column name
CREATE TABLE music_library (
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
CREATE INDEX idx_music_library_user ON music_library(clerk_user_id);
CREATE INDEX idx_music_library_created ON music_library(created_at DESC);
CREATE INDEX idx_music_library_status ON music_library(status);

-- Enable Row Level Security
ALTER TABLE music_library ENABLE ROW LEVEL SECURITY;

-- RLS Policies (API uses Service Role Key which bypasses these)
CREATE POLICY "Users can view own music" 
  ON music_library FOR SELECT 
  USING (true);

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

-- Verify the table exists with correct column
SELECT 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'music_library' 
ORDER BY ordinal_position;

-- Migration complete! ✅
