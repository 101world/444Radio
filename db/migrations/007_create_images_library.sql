-- =====================================================
-- 444 RADIO: IMAGES LIBRARY TABLE
-- =====================================================
-- Migration 007: Create images_library table to store all generated images/cover art
-- =====================================================

-- Create images_library table
CREATE TABLE IF NOT EXISTS images_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- Clerk user ID
  
  -- Image details
  title TEXT,
  prompt TEXT NOT NULL,
  image_url TEXT NOT NULL, -- R2 permanent URL
  
  -- Metadata
  width INTEGER,
  height INTEGER,
  file_size BIGINT, -- in bytes
  image_format TEXT DEFAULT 'webp',
  aspect_ratio TEXT DEFAULT '1:1', -- e.g., "1:1", "16:9", "9:16"
  
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
CREATE INDEX IF NOT EXISTS idx_images_library_user ON images_library(user_id);
CREATE INDEX IF NOT EXISTS idx_images_library_created ON images_library(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_library_status ON images_library(status);

-- Enable Row Level Security
ALTER TABLE images_library ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Users can view own images" ON images_library;
DROP POLICY IF EXISTS "Users can insert own images" ON images_library;
DROP POLICY IF EXISTS "Users can update own images" ON images_library;
DROP POLICY IF EXISTS "Users can delete own images" ON images_library;

-- RLS Policies (API uses Service Role Key which bypasses these)
CREATE POLICY "Users can view own images" 
  ON images_library FOR SELECT 
  USING (true); -- Allow all for now, API will handle auth

CREATE POLICY "Users can insert own images" 
  ON images_library FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can update own images" 
  ON images_library FOR UPDATE 
  USING (true);

CREATE POLICY "Users can delete own images" 
  ON images_library FOR DELETE 
  USING (true);

-- Add helpful comments
COMMENT ON TABLE images_library IS 'Stores all generated images/cover art per user';
COMMENT ON COLUMN images_library.user_id IS 'Clerk user ID who generated this image';
COMMENT ON COLUMN images_library.image_url IS 'Permanent R2 URL for image file';
COMMENT ON COLUMN images_library.generation_params IS 'JSON object with model, steps, etc used for generation';

-- Migration complete! ✅
