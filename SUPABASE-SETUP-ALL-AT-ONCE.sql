-- ============================================
-- 444RADIO - COMPLETE DATABASE SETUP
-- Run this entire script in Supabase SQL Editor
-- Date: October 29, 2025
-- ============================================

-- This script will:
-- 1. Add likes functionality to combined_media
-- 2. Create media_likes junction table
-- 3. Add banner support to user profiles
-- 4. Set up all indexes and RLS policies

BEGIN;

-- ============================================
-- PART 1: ADD LIKES TO COMBINED_MEDIA
-- ============================================

-- Add likes column to combined_media table
ALTER TABLE combined_media 
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;

-- Create media_likes junction table to track who liked what
CREATE TABLE IF NOT EXISTS media_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  media_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, media_id),
  CONSTRAINT fk_media_likes_user FOREIGN KEY (user_id) 
    REFERENCES users(clerk_user_id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_media_likes_user ON media_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_media_likes_media ON media_likes(media_id);
CREATE INDEX IF NOT EXISTS idx_media_likes_created ON media_likes(created_at DESC);

-- Add index on likes column
CREATE INDEX IF NOT EXISTS idx_combined_media_likes ON combined_media(likes DESC);

-- RLS Policies for media_likes table
ALTER TABLE media_likes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Anyone can view likes" ON media_likes;
DROP POLICY IF EXISTS "Users can create own likes" ON media_likes;
DROP POLICY IF EXISTS "Users can delete own likes" ON media_likes;

CREATE POLICY "Anyone can view likes"
  ON media_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can create own likes"
  ON media_likes FOR INSERT
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can delete own likes"
  ON media_likes FOR DELETE
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Grant permissions
GRANT ALL ON media_likes TO service_role;
GRANT SELECT ON media_likes TO anon;
GRANT SELECT ON media_likes TO authenticated;

-- Comments
COMMENT ON TABLE media_likes IS 'Tracks which users have liked which media content';
COMMENT ON COLUMN combined_media.likes IS 'Total number of likes for this media';

-- ============================================
-- PART 2: ADD BANNER SUPPORT TO USERS
-- ============================================

-- Add banner_url column to users table for profile banner customization
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS banner_url TEXT,
ADD COLUMN IF NOT EXISTS banner_type TEXT DEFAULT 'image'; -- 'image' or 'video'

-- Add index
CREATE INDEX IF NOT EXISTS idx_users_banner ON users(banner_url) WHERE banner_url IS NOT NULL;

-- Comments
COMMENT ON COLUMN users.banner_url IS 'Custom banner image or video URL for profile page';
COMMENT ON COLUMN users.banner_type IS 'Type of banner content: image or video';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if likes column was added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'combined_media' 
    AND column_name = 'likes'
  ) THEN
    RAISE NOTICE '✅ likes column added to combined_media';
  END IF;
END $$;

-- Check if media_likes table was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_name = 'media_likes'
  ) THEN
    RAISE NOTICE '✅ media_likes table created';
  END IF;
END $$;

-- Check if banner columns were added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'banner_url'
  ) THEN
    RAISE NOTICE '✅ banner_url column added to users';
  END IF;
END $$;

COMMIT;

-- ============================================
-- SETUP COMPLETE! 
-- ============================================
-- You can now:
-- 1. Like/unlike media content
-- 2. Track play counts and like counts on profiles
-- 3. Upload custom profile banners
-- 4. Generate music in multiple languages (English = MiniMax, Others = ACE-Step)
-- ============================================
