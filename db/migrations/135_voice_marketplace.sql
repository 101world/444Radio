-- Migration 135: Voice marketplace — listings & royalties
-- voice_trainings table already exists from migration 134.
-- This migration adds:
--   1. voice_listings — users can list their trained voices on the Earn marketplace
--   2. voice_royalties — tracks which user earned royalties from voice usage

-- ─── VOICE LISTINGS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voice_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_training_id UUID NOT NULL REFERENCES voice_trainings(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  voice_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  preview_url TEXT,
  price_credits INTEGER NOT NULL DEFAULT 0,          -- 0 = free for others to use
  is_active BOOLEAN NOT NULL DEFAULT true,
  total_uses INTEGER NOT NULL DEFAULT 0,
  total_royalties_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_listings_user ON voice_listings(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_voice_listings_active ON voice_listings(is_active) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_listings_voice_id ON voice_listings(voice_id);

-- ─── VOICE ROYALTIES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voice_royalties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_listing_id UUID NOT NULL REFERENCES voice_listings(id) ON DELETE CASCADE,
  voice_owner_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  generator_user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  credits_earned INTEGER NOT NULL DEFAULT 1,
  generation_type TEXT NOT NULL DEFAULT 'music-01',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_royalties_owner ON voice_royalties(voice_owner_id);
CREATE INDEX IF NOT EXISTS idx_voice_royalties_listing ON voice_royalties(voice_listing_id);

-- ─── RLS ───────────────────────────────────────────────────────
ALTER TABLE voice_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_royalties ENABLE ROW LEVEL SECURITY;

-- Anyone can read active listings (public marketplace)
CREATE POLICY voice_listings_public_read ON voice_listings
  FOR SELECT USING (is_active = true);

-- Service role can do everything
CREATE POLICY voice_listings_service ON voice_listings
  FOR ALL USING (true) WITH CHECK (true);

-- Voice royalties: owner can view their own
CREATE POLICY voice_royalties_owner_read ON voice_royalties
  FOR SELECT USING (voice_owner_id = current_setting('request.jwt.claim.sub', true));

-- Service role full access
CREATE POLICY voice_royalties_service ON voice_royalties
  FOR ALL USING (true) WITH CHECK (true);
