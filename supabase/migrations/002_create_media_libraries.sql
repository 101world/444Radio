-- ============================================
-- MIGRATION: Create Media Libraries Tables
-- Date: 2025-10-20
-- Description: Create tables to store all generated media (music, images, videos)
-- ============================================

-- 1. MUSIC LIBRARY TABLE
-- Stores all generated music files per user
CREATE TABLE IF NOT EXISTS music_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User reference
  clerk_user_id TEXT NOT NULL,
  
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
  
  -- Generation params
  replicate_id TEXT,
  generation_params JSONB,
  
  -- Status
  status TEXT DEFAULT 'ready', -- ready, processing, failed
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Foreign key to users table
  CONSTRAINT fk_music_user FOREIGN KEY (clerk_user_id) 
    REFERENCES users(clerk_user_id) ON DELETE CASCADE
);

-- Indexes for music_library
CREATE INDEX IF NOT EXISTS idx_music_library_user 
  ON music_library(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_music_library_created 
  ON music_library(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_music_library_status 
  ON music_library(status) WHERE status = 'ready';

-- ============================================

-- 2. IMAGES LIBRARY TABLE
-- Stores all generated images/cover art per user
CREATE TABLE IF NOT EXISTS images_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User reference
  clerk_user_id TEXT NOT NULL,
  
  -- Image details
  title TEXT,
  prompt TEXT NOT NULL,
  image_url TEXT NOT NULL, -- R2 permanent URL
  
  -- Metadata
  width INTEGER,
  height INTEGER,
  file_size BIGINT,
  image_format TEXT DEFAULT 'webp',
  aspect_ratio TEXT DEFAULT '1:1',
  
  -- Generation params
  replicate_id TEXT,
  generation_params JSONB,
  
  -- Status
  status TEXT DEFAULT 'ready',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Foreign key
  CONSTRAINT fk_images_user FOREIGN KEY (clerk_user_id) 
    REFERENCES users(clerk_user_id) ON DELETE CASCADE
);

-- Indexes for images_library
CREATE INDEX IF NOT EXISTS idx_images_library_user 
  ON images_library(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_images_library_created 
  ON images_library(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_library_status 
  ON images_library(status) WHERE status = 'ready';

-- ============================================

-- 3. VIDEOS LIBRARY TABLE (For future video generation)
-- Stores all generated videos per user
CREATE TABLE IF NOT EXISTS videos_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User reference
  clerk_user_id TEXT NOT NULL,
  
  -- Video details
  title TEXT,
  prompt TEXT NOT NULL,
  video_url TEXT NOT NULL, -- R2 permanent URL
  thumbnail_url TEXT, -- R2 URL
  
  -- Metadata
  duration INTEGER,
  width INTEGER,
  height INTEGER,
  file_size BIGINT,
  video_format TEXT DEFAULT 'mp4',
  fps INTEGER DEFAULT 24,
  
  -- Generation params
  replicate_id TEXT,
  generation_params JSONB,
  
  -- Status
  status TEXT DEFAULT 'ready',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Foreign key
  CONSTRAINT fk_videos_user FOREIGN KEY (clerk_user_id) 
    REFERENCES users(clerk_user_id) ON DELETE CASCADE
);

-- Indexes for videos_library
CREATE INDEX IF NOT EXISTS idx_videos_library_user 
  ON videos_library(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_videos_library_created 
  ON videos_library(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_library_status 
  ON videos_library(status) WHERE status = 'ready';

-- ============================================

-- ROW LEVEL SECURITY (RLS) POLICIES
-- Enable RLS on all tables

ALTER TABLE music_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE images_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos_library ENABLE ROW LEVEL SECURITY;

-- Music Library Policies
CREATE POLICY "Users can view their own music"
  ON music_library FOR SELECT
  USING (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert their own music"
  ON music_library FOR INSERT
  WITH CHECK (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update their own music"
  ON music_library FOR UPDATE
  USING (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can delete their own music"
  ON music_library FOR DELETE
  USING (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Images Library Policies
CREATE POLICY "Users can view their own images"
  ON images_library FOR SELECT
  USING (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert their own images"
  ON images_library FOR INSERT
  WITH CHECK (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update their own images"
  ON images_library FOR UPDATE
  USING (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can delete their own images"
  ON images_library FOR DELETE
  USING (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Videos Library Policies
CREATE POLICY "Users can view their own videos"
  ON videos_library FOR SELECT
  USING (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert their own videos"
  ON videos_library FOR INSERT
  WITH CHECK (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update their own videos"
  ON videos_library FOR UPDATE
  USING (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can delete their own videos"
  ON videos_library FOR DELETE
  USING (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- ============================================

-- Grant permissions to service role
GRANT ALL ON music_library TO service_role;
GRANT ALL ON images_library TO service_role;
GRANT ALL ON videos_library TO service_role;

-- ============================================

COMMENT ON TABLE music_library IS 'Stores all AI-generated music files for each user with metadata and R2 URLs';
COMMENT ON TABLE images_library IS 'Stores all AI-generated images/cover art for each user with metadata and R2 URLs';
COMMENT ON TABLE videos_library IS 'Stores all AI-generated videos for each user with metadata and R2 URLs (future feature)';
