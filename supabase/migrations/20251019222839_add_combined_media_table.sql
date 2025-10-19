-- Create combined_media table
CREATE TABLE IF NOT EXISTS public.combined_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  image_url TEXT NOT NULL,
  title TEXT,
  audio_prompt TEXT,
  image_prompt TEXT,
  is_public BOOLEAN DEFAULT true,
  likes INTEGER DEFAULT 0,
  plays INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_combined_media_user_id ON public.combined_media(user_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_combined_media_created_at ON public.combined_media(created_at DESC);

-- Create index on is_public for explore page
CREATE INDEX IF NOT EXISTS idx_combined_media_public ON public.combined_media(is_public) WHERE is_public = true;

-- Enable Row Level Security
ALTER TABLE public.combined_media ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own combined media
CREATE POLICY "Users can view own combined media"
  ON public.combined_media
  FOR SELECT
  USING (auth.uid()::text = user_id);

-- Policy: Users can view public combined media
CREATE POLICY "Anyone can view public combined media"
  ON public.combined_media
  FOR SELECT
  USING (is_public = true);

-- Policy: Users can insert their own combined media
CREATE POLICY "Users can create combined media"
  ON public.combined_media
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Policy: Users can update their own combined media
CREATE POLICY "Users can update own combined media"
  ON public.combined_media
  FOR UPDATE
  USING (auth.uid()::text = user_id);

-- Policy: Users can delete their own combined media
CREATE POLICY "Users can delete own combined media"
  ON public.combined_media
  FOR DELETE
  USING (auth.uid()::text = user_id);
