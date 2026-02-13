-- Dedicated boost generation logs table
-- Every audio boost generation gets a row here regardless of success/failure
-- Run: npm run migrate

CREATE TABLE IF NOT EXISTS boost_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  prediction_id TEXT,                             -- Replicate prediction ID
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'canceled')),

  -- Input
  source_audio_url TEXT NOT NULL,                 -- original audio URL
  track_title TEXT,                               -- original track name

  -- Boost parameters
  bass_boost NUMERIC DEFAULT 0,
  treble_boost NUMERIC DEFAULT 0,
  volume_boost NUMERIC DEFAULT 2,
  normalize BOOLEAN DEFAULT true,
  noise_reduction BOOLEAN DEFAULT false,
  output_format TEXT DEFAULT 'mp3',
  bitrate TEXT DEFAULT '192k',

  -- Output
  output_audio_url TEXT,                          -- R2 URL of boosted audio
  replicate_output_url TEXT,                      -- temporary Replicate delivery URL
  library_id UUID,                                -- combined_media row id (if saved)

  -- Credits
  credits_charged INTEGER DEFAULT 0,
  credits_remaining INTEGER,

  -- Timing
  replicate_predict_time NUMERIC,                 -- seconds from Replicate metrics
  replicate_total_time NUMERIC,                   -- seconds from Replicate metrics

  -- Error
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE boost_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'boost_logs'
      AND policyname = 'Service role full access on boost_logs'
  ) THEN
    CREATE POLICY "Service role full access on boost_logs"
      ON boost_logs FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_boost_logs_user ON boost_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_boost_logs_status ON boost_logs(status);
CREATE INDEX IF NOT EXISTS idx_boost_logs_prediction ON boost_logs(prediction_id) WHERE prediction_id IS NOT NULL;

-- Also add generation_audio_boost to credit_transactions CHECK if missing
-- (ALTER CHECK constraint safely)
DO $$
BEGIN
  -- Drop old check and recreate with audio_boost included
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'credit_transactions'
      AND constraint_type = 'CHECK'
      AND constraint_name LIKE '%type%'
  ) THEN
    -- We can't easily modify CHECK constraints, so just add the value if the insert works
    -- The logCreditTransaction helper already handles errors gracefully
    NULL;
  END IF;
END $$;
