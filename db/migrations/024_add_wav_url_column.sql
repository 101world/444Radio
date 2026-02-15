-- Migration 024: WAV cache system
-- Stores permanently cached WAV files in R2, keyed by the original audio URL.
-- Works for ALL tracks: plugin library, create page, released or unreleased.
-- First WAV request converts client-side, uploads to R2, stores URL here.
-- Subsequent requests return the cached WAV instantly.

-- Add wav_url to combined_media for released tracks
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS wav_url TEXT;

-- Standalone cache table for ALL audio (including unreleased plugin tracks)
CREATE TABLE IF NOT EXISTS wav_cache (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audio_url   TEXT NOT NULL UNIQUE,   -- original MP3 R2 URL (lookup key)
  wav_url     TEXT NOT NULL,          -- permanent WAV R2 URL
  created_by  TEXT,                   -- clerk_user_id of whoever triggered it
  file_size   BIGINT,                 -- WAV size in bytes (analytics)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookups by audio_url
CREATE INDEX IF NOT EXISTS idx_wav_cache_audio_url ON wav_cache (audio_url);
