-- Add likes system for combined_media releases
-- Migration 005: Likes System

-- Add likes_count column to combined_media table
ALTER TABLE combined_media
ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- Create user_likes junction table to track who liked what
CREATE TABLE IF NOT EXISTS user_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- Clerk user ID
  release_id UUID NOT NULL REFERENCES combined_media(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure user can only like a release once
  UNIQUE(user_id, release_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_likes_user ON user_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_likes_release ON user_likes(release_id);
CREATE INDEX IF NOT EXISTS idx_user_likes_created ON user_likes(created_at DESC);

-- Add index on combined_media likes_count for sorting by popularity
CREATE INDEX IF NOT EXISTS idx_combined_media_likes ON combined_media(likes_count DESC);

-- Enable Row Level Security
ALTER TABLE user_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_likes
-- Users can view all likes
CREATE POLICY "Anyone can view likes"
  ON user_likes FOR SELECT
  USING (true);

-- Users can only create their own likes
CREATE POLICY "Users can create own likes"
  ON user_likes FOR INSERT
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Users can only delete their own likes
CREATE POLICY "Users can delete own likes"
  ON user_likes FOR DELETE
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Function to update likes_count on combined_media
CREATE OR REPLACE FUNCTION update_combined_media_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE combined_media
    SET likes_count = likes_count + 1
    WHERE id = NEW.release_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE combined_media
    SET likes_count = GREATEST(likes_count - 1, 0)
    WHERE id = OLD.release_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update likes_count
DROP TRIGGER IF EXISTS trigger_update_likes_count ON user_likes;
CREATE TRIGGER trigger_update_likes_count
  AFTER INSERT OR DELETE ON user_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_combined_media_likes_count();

-- Backfill existing likes_count (if any user_likes exist)
UPDATE combined_media cm
SET likes_count = (
  SELECT COUNT(*)
  FROM user_likes ul
  WHERE ul.release_id = cm.id
);

COMMENT ON TABLE user_likes IS 'Tracks which users liked which releases';
COMMENT ON COLUMN combined_media.likes_count IS 'Cached count of likes for performance';
