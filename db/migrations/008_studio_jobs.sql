-- Studio Jobs Table
-- Tracks AI generation jobs from multi-track studio

CREATE TABLE IF NOT EXISTS studio_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'create-song', 'create-beat', 'stem-split', 'auto-tune', 'effects'
  status TEXT NOT NULL DEFAULT 'queued', -- 'queued', 'processing', 'completed', 'failed'
  params JSONB DEFAULT '{}',
  replicate_prediction_id TEXT,
  output JSONB, -- { audio: 'url' } or { vocals: 'url', drums: 'url', ... } for stems
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_studio_jobs_user_id ON studio_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_studio_jobs_status ON studio_jobs(status);
CREATE INDEX IF NOT EXISTS idx_studio_jobs_replicate_id ON studio_jobs(replicate_prediction_id);
CREATE INDEX IF NOT EXISTS idx_studio_jobs_created_at ON studio_jobs(created_at DESC);

-- RLS Policies (users can only see their own jobs)
ALTER TABLE studio_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs"
  ON studio_jobs
  FOR SELECT
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert own jobs"
  ON studio_jobs
  FOR INSERT
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

COMMENT ON TABLE studio_jobs IS 'Tracks AI generation jobs from multi-track studio with webhook callbacks';
