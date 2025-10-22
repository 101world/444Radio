-- Create code_redemptions table to track when users redeem access codes
-- Enforces one-time-per-month access per user per code

CREATE TABLE IF NOT EXISTS code_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL,
  code TEXT NOT NULL,
  credits_awarded INTEGER NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  redemption_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure a user can only have one active redemption per code
  CONSTRAINT unique_user_code UNIQUE (clerk_user_id, code)
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_code_redemptions_user 
  ON code_redemptions(clerk_user_id);

-- Index for fast lookups by code
CREATE INDEX IF NOT EXISTS idx_code_redemptions_code 
  ON code_redemptions(code);

-- Index for checking recent redemptions (within last month)
CREATE INDEX IF NOT EXISTS idx_code_redemptions_recent 
  ON code_redemptions(clerk_user_id, code, redeemed_at);

-- Comment on the table
COMMENT ON TABLE code_redemptions IS 
  'Tracks code redemptions with one-month access window per user per code';

COMMENT ON COLUMN code_redemptions.clerk_user_id IS 
  'Clerk user ID of the user who redeemed the code';

COMMENT ON COLUMN code_redemptions.code IS 
  'The redemption code (normalized to uppercase)';

COMMENT ON COLUMN code_redemptions.credits_awarded IS 
  'Number of credits awarded for this redemption';

COMMENT ON COLUMN code_redemptions.redeemed_at IS 
  'Timestamp when the code was last redeemed (updates after 1-month window)';

COMMENT ON COLUMN code_redemptions.redemption_count IS 
  'Total number of times this user has redeemed this code';
