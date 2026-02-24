-- Migration 136: Voice Labs chat sessions
-- Stores TTS generation sessions so users can create new chats,
-- save history, and access past generations.

CREATE TABLE IF NOT EXISTS voice_labs_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Session',
  voice_id TEXT,                        -- Last used voice_id
  settings JSONB DEFAULT '{}',          -- Last used TTS settings (speed, pitch, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_labs_sessions_user ON voice_labs_sessions(clerk_user_id);

CREATE TABLE IF NOT EXISTS voice_labs_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES voice_labs_sessions(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  text TEXT NOT NULL,                    -- The input text
  voice_id TEXT NOT NULL,                -- Voice used
  audio_url TEXT,                        -- Generated audio URL (null while generating)
  credits_cost INTEGER NOT NULL DEFAULT 0,
  settings JSONB DEFAULT '{}',           -- Full generation params snapshot
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('generating', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_labs_messages_session ON voice_labs_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_voice_labs_messages_user ON voice_labs_messages(clerk_user_id);

-- RLS
ALTER TABLE voice_labs_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_labs_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access voice_labs_sessions"
  ON voice_labs_sessions FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access voice_labs_messages"
  ON voice_labs_messages FOR ALL USING (true) WITH CHECK (true);
