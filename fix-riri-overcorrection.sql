-- ============================================================================
-- Fix Riri's Credits - CORRECT CALCULATION
-- User: riri (user_34LKhAX7aYSnMboQLn5S8vVbzoQ)
--
-- Issue: Over-corrected on Feb 15, 2026
--   - Removed 114 credits but should have removed only 89
--   - Over-correction: 25 credits
--
-- Timeline Discovery:
--   - Dec 15: Used 4 credits (2 generations)
--   - Feb 15 before gens: Had 162 credits
--   - Total received: 166 credits (162 + 4 already used)
--   - Expected: 77 credits (20 decrypt + 57 from $2 deposit)
--   - Excess: 166 - 77 = 89 credits
--   - Correction applied: -114 credits (TOO MUCH by 25)
--
-- Current State:
--   - Balance: 45 credits
--   - Used: 7 credits total (2+2+2+1)
--   - Should have: 77 - 7 = 70 credits
--   - Missing: 25 credits
-- ============================================================================

-- Step 1: Verify current state
SELECT 
  clerk_user_id,
  username,
  credits,
  wallet_balance,
  total_generated
FROM users
WHERE clerk_user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ';

-- Step 2: Apply correction (+25 credits)
UPDATE users
SET credits = 70,
    updated_at = NOW()
WHERE clerk_user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ'
  AND credits = 45;  -- Safety check

-- Step 3: Log the correction
INSERT INTO credit_transactions (
  user_id,
  amount,
  balance_after,
  type,
  status,
  description,
  metadata
) VALUES (
  'user_34LKhAX7aYSnMboQLn5S8vVbzoQ',
  25,  -- Add back 25 credits
  70,  -- New balance
  'credit_award',
  'success',
  'Correction: Over-correction fix. Removed 114 but should have removed 89.',
  jsonb_build_object(
    'reason', 'over_correction_fix',
    'previous_balance', 45,
    'original_correction', -114,
    'correct_correction', -89,
    'over_corrected_by', 25,
    'initial_credits_received', 166,
    'expected_credits', 77,
    'total_used', 7,
    'calculation', '77 total - 7 used = 70 correct balance'
  )
);

-- Step 4: Verify correction
SELECT 
  clerk_user_id,
  username,
  credits AS current_balance,
  wallet_balance
FROM users
WHERE clerk_user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ';

-- ============================================================================
-- Expected result: credits = 70
-- ============================================================================
