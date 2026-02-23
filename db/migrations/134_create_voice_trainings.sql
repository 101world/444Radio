-- 134: Create voice_trainings table for storing MiniMax voice cloning results
-- Each row represents a trained voice that users can reuse for music generation

CREATE TABLE IF NOT EXISTS voice_trainings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  voice_id TEXT NOT NULL,              -- The voice ID returned by minimax/voice-cloning
  name TEXT NOT NULL DEFAULT 'Untitled Voice',
  source_audio_url TEXT,               -- R2 URL of the original voice file used for training
  model TEXT DEFAULT 'speech-02-turbo', -- The TTS model used for training
  preview_url TEXT,                     -- Preview audio URL from the training output
  status TEXT DEFAULT 'ready' CHECK (status IN ('training', 'ready', 'failed')),
  metadata JSONB DEFAULT '{}',         -- Extra data (accuracy, noise_reduction, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_voice_trainings_clerk_user_id ON voice_trainings(clerk_user_id);

-- RLS policies
ALTER TABLE voice_trainings ENABLE ROW LEVEL SECURITY;

-- Users can read their own voice trainings
CREATE POLICY "Users can read own voice trainings"
  ON voice_trainings FOR SELECT
  USING (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Service role can do everything
CREATE POLICY "Service role full access to voice trainings"
  ON voice_trainings FOR ALL
  USING (true)
  WITH CHECK (true);
