-- ============================================================
-- PATTERNS TABLE
-- ============================================================
-- Stores user-submitted input patterns (prompt templates)
-- that can be shared and copied by other users.
-- Date: 2026-02-28
-- ============================================================

CREATE TABLE IF NOT EXISTS patterns (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,               -- clerk_user_id
  username    TEXT,                         -- cached username
  title       TEXT NOT NULL,               -- pattern name
  description TEXT DEFAULT '',             -- short description
  code        TEXT NOT NULL,               -- the full pattern/prompt text
  genre       TEXT,                         -- optional genre tag
  copies      INTEGER NOT NULL DEFAULT 0,  -- copy count
  likes       INTEGER NOT NULL DEFAULT 0,  -- like count
  is_public   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patterns_user ON patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_patterns_public ON patterns(is_public, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patterns_genre ON patterns(genre);
