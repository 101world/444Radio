-- Create profile_media table for standalone images and videos
CREATE TABLE IF NOT EXISTS profile_media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('image', 'video', 'music-image')),
  
  -- URLs for different media types
  image_url TEXT,
  video_url TEXT,
  audio_url TEXT,
  
  -- Metadata
  is_public BOOLEAN DEFAULT true,
  likes INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profile_media_user_id ON profile_media(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_media_content_type ON profile_media(content_type);
CREATE INDEX IF NOT EXISTS idx_profile_media_created_at ON profile_media(created_at DESC);

-- Enable Row Level Security
ALTER TABLE profile_media ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all public media
CREATE POLICY "Public media is viewable by everyone"
  ON profile_media
  FOR SELECT
  USING (is_public = true);

-- Policy: Users can insert their own media
CREATE POLICY "Users can insert their own media"
  ON profile_media
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Policy: Users can update their own media
CREATE POLICY "Users can update their own media"
  ON profile_media
  FOR UPDATE
  USING (auth.uid()::text = user_id);

-- Policy: Users can delete their own media
CREATE POLICY "Users can delete their own media"
  ON profile_media
  FOR DELETE
  USING (auth.uid()::text = user_id);

-- Add content_type column to combined_media table if it doesn't exist
ALTER TABLE combined_media 
ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'music-image';

-- Create storage buckets if they don't exist (run these in Supabase Storage dashboard):
-- 1. Create bucket 'audio-files' (if not exists) - Public
-- 2. Create bucket 'images' (if not exists) - Public  
-- 3. Create bucket 'videos' (if not exists) - Public
