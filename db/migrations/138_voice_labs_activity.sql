-- Migration 138: Voice Labs Activity Tracking
-- Logs every input session and generation for admin analytics.
-- Tracks: input start/stop, typing duration, text revisions, generations, per-user stats.

CREATE TABLE IF NOT EXISTS voice_labs_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,                   -- Clerk user ID
  session_id TEXT,                         -- voice_labs_sessions.id (nullable for non-session activity)
  event_type TEXT NOT NULL,                -- 'input_start', 'input_end', 'generation_start', 'generation_complete', 'generation_failed', 'voice_change', 'settings_change', 'session_open', 'session_close'
  
  -- Input tracking
  text_length INTEGER,                     -- Character count at event time
  text_snapshot TEXT,                       -- Full text at event (for generation events)
  input_duration_ms INTEGER,               -- How long user spent typing (input_end events)
  keystroke_count INTEGER,                 -- Number of keystrokes during input session
  paste_count INTEGER,                     -- Number of paste events
  delete_count INTEGER,                    -- Number of delete/backspace presses
  revision_count INTEGER,                  -- Number of text changes (distinct edits)
  
  -- Generation tracking
  voice_id TEXT,
  tokens_consumed INTEGER,
  credits_spent INTEGER,
  generation_duration_ms INTEGER,          -- How long generation took
  audio_url TEXT,
  
  -- Settings snapshot
  settings JSONB DEFAULT '{}',             -- Full settings at time of event (speed, pitch, emotion, etc.)
  
  -- Device/context
  ip_address TEXT,
  user_agent TEXT,
  
  metadata JSONB DEFAULT '{}',             -- Flexible extra data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for admin queries
CREATE INDEX IF NOT EXISTS idx_vla_user_id ON voice_labs_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_vla_event_type ON voice_labs_activity(event_type);
CREATE INDEX IF NOT EXISTS idx_vla_created_at ON voice_labs_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vla_user_event ON voice_labs_activity(user_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vla_session ON voice_labs_activity(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vla_generations ON voice_labs_activity(event_type, created_at DESC)
  WHERE event_type IN ('generation_complete', 'generation_failed');

-- RLS: only service-role (admin) can read
ALTER TABLE voice_labs_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin only voice labs activity" ON voice_labs_activity;
CREATE POLICY "Admin only voice labs activity" ON voice_labs_activity
  FOR SELECT USING (false);

-- Aggregation helper: per-user Voice Labs stats
CREATE OR REPLACE FUNCTION get_voice_labs_user_stats(
  p_user_id TEXT DEFAULT NULL,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  user_id TEXT,
  total_generations INTEGER,
  successful_generations INTEGER,
  failed_generations INTEGER,
  total_tokens_consumed BIGINT,
  total_credits_spent BIGINT,
  total_input_time_ms BIGINT,
  total_keystroke_count BIGINT,
  avg_text_length NUMERIC,
  max_text_length INTEGER,
  voices_used JSONB,
  first_activity TIMESTAMPTZ,
  last_activity TIMESTAMPTZ,
  session_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vla.user_id,
    COUNT(*) FILTER (WHERE vla.event_type IN ('generation_complete', 'generation_failed'))::INTEGER AS total_generations,
    COUNT(*) FILTER (WHERE vla.event_type = 'generation_complete')::INTEGER AS successful_generations,
    COUNT(*) FILTER (WHERE vla.event_type = 'generation_failed')::INTEGER AS failed_generations,
    COALESCE(SUM(vla.tokens_consumed) FILTER (WHERE vla.event_type = 'generation_complete'), 0)::BIGINT AS total_tokens_consumed,
    COALESCE(SUM(vla.credits_spent) FILTER (WHERE vla.event_type = 'generation_complete'), 0)::BIGINT AS total_credits_spent,
    COALESCE(SUM(vla.input_duration_ms) FILTER (WHERE vla.event_type = 'input_end'), 0)::BIGINT AS total_input_time_ms,
    COALESCE(SUM(vla.keystroke_count) FILTER (WHERE vla.event_type = 'input_end'), 0)::BIGINT AS total_keystroke_count,
    ROUND(AVG(vla.text_length) FILTER (WHERE vla.event_type IN ('generation_complete', 'generation_failed')), 1) AS avg_text_length,
    MAX(vla.text_length) FILTER (WHERE vla.event_type IN ('generation_complete', 'generation_failed')) AS max_text_length,
    COALESCE(
      jsonb_agg(DISTINCT vla.voice_id) FILTER (WHERE vla.voice_id IS NOT NULL),
      '[]'::jsonb
    ) AS voices_used,
    MIN(vla.created_at) AS first_activity,
    MAX(vla.created_at) AS last_activity,
    COUNT(DISTINCT vla.session_id) AS session_count
  FROM voice_labs_activity vla
  WHERE (p_user_id IS NULL OR vla.user_id = p_user_id)
    AND vla.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY vla.user_id
  ORDER BY MAX(vla.created_at) DESC;
END;
$$;

COMMENT ON TABLE voice_labs_activity IS 'Detailed activity tracking for Voice Labs - every input session, generation, and user action';
