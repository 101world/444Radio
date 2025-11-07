-- Create play_credits table for tracking 1-play-per-user-per-song-per-day
-- This prevents play count spam and enables fair play tracking

CREATE TABLE IF NOT EXISTS public.play_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  media_id UUID NOT NULL,
  user_id TEXT NOT NULL, -- Clerk user ID
  
  -- Tracking
  played_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: one play per user per song per day
  UNIQUE(media_id, user_id, played_on)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_play_credits_media_id ON public.play_credits(media_id);
CREATE INDEX IF NOT EXISTS idx_play_credits_user_id ON public.play_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_play_credits_played_on ON public.play_credits(played_on DESC);
CREATE INDEX IF NOT EXISTS idx_play_credits_media_user_date ON public.play_credits(media_id, user_id, played_on);

-- Enable Row Level Security
ALTER TABLE public.play_credits ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own play history
CREATE POLICY "Users can view own play credits"
  ON public.play_credits
  FOR SELECT
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Policy: Anyone can insert play credits (for tracking plays)
CREATE POLICY "Anyone can insert play credits"
  ON public.play_credits
  FOR INSERT
  WITH CHECK (true);

-- Policy: No updates or deletes (immutable tracking)
-- (No policies = no one can UPDATE or DELETE)

-- Grant permissions
GRANT SELECT, INSERT ON public.play_credits TO service_role;
GRANT SELECT ON public.play_credits TO authenticated;

-- Comments
COMMENT ON TABLE public.play_credits IS 'Tracks daily plays per user per song to prevent spam and enable fair play counting';
COMMENT ON COLUMN public.play_credits.played_on IS 'Date (not timestamp) to enforce daily uniqueness';
