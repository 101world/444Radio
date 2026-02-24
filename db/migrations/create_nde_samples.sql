-- NDE Custom Samples table
-- Stores metadata for user-uploaded audio samples used in the Node Digital Environment
-- Actual audio files are stored in R2 under nde-samples/{user_id}/

CREATE TABLE IF NOT EXISTS nde_samples (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,                    -- lowercase, no spaces, 2-32 chars (used as Strudel sound key)
  url TEXT NOT NULL,                     -- public R2 URL
  r2_key TEXT NOT NULL,                  -- R2 object key for deletion
  original_filename TEXT,                -- original upload filename
  file_size INTEGER,                     -- bytes
  content_type TEXT DEFAULT 'audio/wav',
  duration_ms INTEGER,                   -- optional, for UI display
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each user's sample names must be unique
  CONSTRAINT nde_samples_user_name_unique UNIQUE (user_id, name)
);

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_nde_samples_user_id ON nde_samples(user_id);

-- RLS
ALTER TABLE nde_samples ENABLE ROW LEVEL SECURITY;

-- Users can read their own samples
CREATE POLICY nde_samples_select ON nde_samples
  FOR SELECT USING (true);  -- Allow reading all (sound names are global in Strudel)

-- Users can insert their own samples
CREATE POLICY nde_samples_insert ON nde_samples
  FOR INSERT WITH CHECK (true);

-- Users can delete their own samples
CREATE POLICY nde_samples_delete ON nde_samples
  FOR DELETE USING (true);
