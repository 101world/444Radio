-- Add daily play bonus system (hybrid: real plays + daily auto-credit)

-- Table to track which songs got their daily bonus
CREATE TABLE IF NOT EXISTS public.daily_play_bonus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL,
  credited_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(media_id, credited_on)
);

-- Indexes
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_daily_play_bonus_media_id') THEN
    CREATE INDEX idx_daily_play_bonus_media_id ON public.daily_play_bonus(media_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_daily_play_bonus_credited_on') THEN
    CREATE INDEX idx_daily_play_bonus_credited_on ON public.daily_play_bonus(credited_on);
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE public.daily_play_bonus ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
  -- Public can view daily bonuses
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'daily_play_bonus' 
    AND policyname = 'Anyone can view daily bonuses'
  ) THEN
    EXECUTE 'CREATE POLICY "Anyone can view daily bonuses" 
             ON public.daily_play_bonus 
             FOR SELECT 
             USING (true)';
  END IF;
  
  -- Only system can insert (via API with service key)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'daily_play_bonus' 
    AND policyname = 'Service role can insert daily bonuses'
  ) THEN
    EXECUTE 'CREATE POLICY "Service role can insert daily bonuses" 
             ON public.daily_play_bonus 
             FOR INSERT 
             WITH CHECK (true)';
  END IF;
END $$;

-- Comment for documentation
COMMENT ON TABLE public.daily_play_bonus IS 'Tracks daily auto-credit bonuses for published songs (hybrid system with play_credits)';
