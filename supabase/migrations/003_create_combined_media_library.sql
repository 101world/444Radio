-- ============================================
-- MIGRATION: Add Combined Media Library
-- Date: 2025-10-20
-- Description: Create table to store combined media (music + cover art combinations)
-- ============================================

-- COMBINED MEDIA LIBRARY TABLE
-- Stores user's combined media creations (music + cover art pairs)
CREATE TABLE IF NOT EXISTS combined_media_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User reference
  clerk_user_id TEXT NOT NULL,
  
  -- Media references (from libraries)
  music_id UUID REFERENCES music_library(id) ON DELETE SET NULL,
  image_id UUID REFERENCES images_library(id) ON DELETE SET NULL,
  
  -- Direct URLs (in case references are deleted)
  audio_url TEXT NOT NULL,
  image_url TEXT NOT NULL,
  
  -- Metadata
  title TEXT,
  music_prompt TEXT,
  image_prompt TEXT,
  
  -- Label/Profile publishing
  is_published BOOLEAN DEFAULT false, -- Published to profile/label
  published_to_label_id UUID, -- Reference to label (future)
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Foreign key
  CONSTRAINT fk_combined_user FOREIGN KEY (clerk_user_id) 
    REFERENCES users(clerk_user_id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_combined_media_library_user 
  ON combined_media_library(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_combined_media_library_created 
  ON combined_media_library(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_combined_media_library_published 
  ON combined_media_library(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_combined_media_library_music 
  ON combined_media_library(music_id) WHERE music_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_combined_media_library_image 
  ON combined_media_library(image_id) WHERE image_id IS NOT NULL;

-- Row Level Security
ALTER TABLE combined_media_library ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own combined media"
  ON combined_media_library FOR SELECT
  USING (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert their own combined media"
  ON combined_media_library FOR INSERT
  WITH CHECK (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update their own combined media"
  ON combined_media_library FOR UPDATE
  USING (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can delete their own combined media"
  ON combined_media_library FOR DELETE
  USING (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Public can view published combined media
CREATE POLICY "Public can view published combined media"
  ON combined_media_library FOR SELECT
  USING (is_published = true);

-- Grant permissions
GRANT ALL ON combined_media_library TO service_role;

-- Comment
COMMENT ON TABLE combined_media_library IS 'Stores combined media (music + cover art) creations before publishing to labels/profiles';
