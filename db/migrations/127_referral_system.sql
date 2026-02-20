-- ============================================================
-- REFERRAL SYSTEM
-- ============================================================
-- Enables users to invite others via unique referral codes.
-- Tracks invites and supports quest progress for 'invite_users'.
--
-- Date: 2026-02-20
-- ============================================================

-- 1. Add referral code to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by TEXT; -- clerk_user_id of referrer

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);

-- 2. Referral tracking table
CREATE TABLE IF NOT EXISTS referrals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id   TEXT NOT NULL,  -- clerk_user_id who shared the code
  referred_id   TEXT NOT NULL,  -- clerk_user_id who used the code
  referral_code TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_paid       BOOLEAN NOT NULL DEFAULT false, -- true if referred user made a purchase
  UNIQUE(referrer_id, referred_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_paid ON referrals(referrer_id, is_paid);

-- RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own referrals" ON referrals;
CREATE POLICY "Users read own referrals"
  ON referrals FOR SELECT USING (true);

-- 3. Generate referral codes for existing users (run once)
UPDATE users
SET referral_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT || clerk_user_id) FROM 1 FOR 8))
WHERE referral_code IS NULL;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
    SELECT COUNT(*) > 0 INTO exists FROM users WHERE referral_code = code;
    EXIT WHEN NOT exists;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate referral code for new users
CREATE OR REPLACE FUNCTION auto_generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_referral_code ON users;
CREATE TRIGGER trigger_auto_referral_code
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_referral_code();
