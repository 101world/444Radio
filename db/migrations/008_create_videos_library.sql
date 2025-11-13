-- =====================================================
-- 444 RADIO: VIDEOS LIBRARY TABLE
-- =====================================================
-- Migration 008: Create videos_library table to store all generated videos
-- =====================================================

-- Create videos_library table
CREATE TABLE IF NOT EXISTS videos_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- Clerk user ID
  
  -- Video details
  title TEXT,
  prompt TEXT NOT NULL,
  video_url TEXT NOT NULL, -- R2 permanent URL
  thumbnail_url TEXT, -- R2 URL for thumbnail
  
  -- Metadata
  duration INTEGER, -- in seconds
  width INTEGER,
  height INTEGER,
  file_size BIGINT, -- in bytes
  video_format TEXT DEFAULT 'mp4',
  fps INTEGER DEFAULT 24,
  codec TEXT DEFAULT 'h264',
  
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
CREATE INDEX IF NOT EXISTS idx_videos_library_user ON videos_library(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_library_created ON videos_library(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_library_status ON videos_library(status);

-- Enable Row Level Security
ALTER TABLE videos_library ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Users can view own videos" ON videos_library;
DROP POLICY IF EXISTS "Users can insert own videos" ON videos_library;
DROP POLICY IF EXISTS "Users can update own videos" ON videos_library;
DROP POLICY IF EXISTS "Users can delete own videos" ON videos_library;

-- RLS Policies (API uses Service Role Key which bypasses these)
CREATE POLICY "Users can view own videos" 
  ON videos_library FOR SELECT 
  USING (true); -- Allow all for now, API will handle auth

CREATE POLICY "Users can insert own videos" 
  ON videos_library FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can update own videos" 
  ON videos_library FOR UPDATE 
  USING (true);

CREATE POLICY "Users can delete own videos" 
  ON videos_library FOR DELETE 
  USING (true);

-- Add helpful comments
COMMENT ON TABLE videos_library IS 'Stores all generated videos per user';
COMMENT ON COLUMN videos_library.user_id IS 'Clerk user ID who generated this video';
COMMENT ON COLUMN videos_library.video_url IS 'Permanent R2 URL for video file';
COMMENT ON COLUMN videos_library.thumbnail_url IS 'R2 URL for video thumbnail image';
COMMENT ON COLUMN videos_library.generation_params IS 'JSON object with model, resolution, etc used for generation';

-- Migration complete! ✅
