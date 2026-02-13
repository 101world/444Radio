-- ============================================================================
-- CLAWBACK: Remove illegitimate credits from user_34J8MP3KCfczODGn9yKMolWPX9R
-- Date: 2026-02-13
--
-- The protect_subscriber_credits trigger auto-refilled 100 credits when
-- the user hit 0. They then used 1, so they should have 0 (or fewer if
-- they had exactly 0 before the bug gave them 100 and they used 1 = 99).
--
-- RUN THIS AFTER deploying migration 1016 (which fixes the trigger),
-- otherwise updating credits will re-trigger the old bug!
-- ============================================================================

-- Step 1: Check current state
SELECT 
  clerk_user_id,
  username,
  email,
  credits,
  total_generated,
  subscription_status,
  subscription_plan,
  updated_at
FROM users 
WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R';

-- Step 2: Remove the 99 illegitimate credits (100 auto-granted minus 1 used)
-- Setting to 0 since they had legitimately reached 0 before the bug refilled them
UPDATE users 
SET credits = GREATEST(credits - 99, 0)
WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R';

-- Step 3: Verify
SELECT clerk_user_id, username, credits, subscription_status
FROM users 
WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R';
