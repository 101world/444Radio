-- ============================================================================
-- Fix riri's credits from double-deposit bug
--
-- User: riri (user_34LKhAX7aYSnMboQLn5S8vVbzoQ)
-- Issue: Double-credit deposit due to webhook + verify route both processing
--
-- Expected state:
--   - Had 20 credits before purchase
--   - Bought $2 USD → should get 57 credits (2 / 0.035 = 57.14 → floor = 57)
--   - Total should be: 20 + 57 = 77 credits
--
-- Current state:
--   - Has 159 credits (as of diagnostic on 2026-02-16)
--
-- Correction:
--   - Excess: 159 - 77 = 82 credits   - Action: Deduct 82 credits via credit_refund transaction
--
-- Date: 2026-02-16
-- ============================================================================

-- Step 1: Check current state
SELECT 
  clerk_user_id,
  username,
  credits,
  wallet_balance,
  total_generated
FROM users
WHERE clerk_user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ';

-- Step 2: Check recent transactions
SELECT 
  id,
  type,
  amount,
  balance_after,
  status,
  description,
  created_at,
  metadata->>'razorpay_payment_id' AS payment_id,
  metadata->>'deposit_usd' AS deposit_usd
FROM credit_transactions
WHERE user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ'
  AND created_at > '2026-02-15'
ORDER BY created_at DESC;

-- Step 3: Apply correction (ONLY RUN AFTER VERIFYING ABOVE QUERIES)
-- IMPORTANT: Check the current credits value above before running this.
-- If current credits != 159, recalculate the correction amount.

-- Update credits to 77 (20 initial + 57 from $2 purchase)
UPDATE users
SET credits = 77,
    updated_at = NOW()
WHERE clerk_user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ'
  AND credits = 159;  -- Safety check: only run if credits are still 159

-- Log the correction transaction
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
  -82,  -- Negative amount (deduction)
  77,   -- New balance
  'credit_refund',
  'success',
  'Correction: Double-deposit bug. Purchased $2 should give 57 credits, not 139.',
  jsonb_build_object(
    'reason', 'double_deposit_correction',
    'bug_date', '2026-02-16',
    'expected_credits', 77,
    'previous_credits', 159,
    'correction_amount', -82,
    'purchase_amount_usd', 2.00,
    'credit_rate', 0.035,
    'initial_credits', 20
  )
);

-- Step 4: Verify correction
SELECT 
  clerk_user_id,
  username,
  credits,
  wallet_balance
FROM users
WHERE clerk_user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ';

-- ============================================================================
-- END FIX
-- ============================================================================
