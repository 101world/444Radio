-- Add likes column and create likes junction table for combined_media

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

-- Comment
COMMENT ON TABLE media_likes IS 'Tracks which users have liked which media content';
COMMENT ON COLUMN combined_media.likes IS 'Total number of likes for this media';
