-- Create generation_callbacks table to store V5 callback payloads
-- V5 delivers track data via callback URL instead of poll response
CREATE TABLE IF NOT EXISTS generation_callbacks (
  task_id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-cleanup: callbacks older than 1 hour are no longer needed
CREATE INDEX IF NOT EXISTS idx_generation_callbacks_created_at ON generation_callbacks (created_at);

-- Allow upsert (merge-duplicates)
COMMENT ON TABLE generation_callbacks IS 'Temporary storage for V5 generation callback payloads. Auto-cleaned after 1 hour.';
