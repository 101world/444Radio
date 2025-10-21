-- Create user_uploads table for storing user uploaded images and videos
CREATE TABLE IF NOT EXISTS user_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  title TEXT,
  description TEXT,
  file_size BIGINT,
  width INTEGER,
  height INTEGER,
  duration INTEGER, -- for videos in seconds
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_user_uploads_user_id ON user_uploads(user_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_user_uploads_created_at ON user_uploads(created_at DESC);

-- Enable Row Level Security
ALTER TABLE user_uploads ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own uploads
CREATE POLICY "Users can view own uploads" ON user_uploads
  FOR SELECT
  USING (auth.uid()::text = user_id);

-- Policy: Users can insert their own uploads
CREATE POLICY "Users can insert own uploads" ON user_uploads
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Policy: Users can update their own uploads
CREATE POLICY "Users can update own uploads" ON user_uploads
  FOR UPDATE
  USING (auth.uid()::text = user_id);

-- Policy: Users can delete their own uploads
CREATE POLICY "Users can delete own uploads" ON user_uploads
  FOR DELETE
  USING (auth.uid()::text = user_id);

-- Policy: Allow public viewing of uploads (for profile pages)
CREATE POLICY "Anyone can view uploads" ON user_uploads
  FOR SELECT
  USING (true);
