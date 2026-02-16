-- ============================================================================
-- Riri Credit Calculation - CORRECTED
-- User: riri (user_34LKhAX7aYSnMboQLn5S8vVbzoQ)
-- ============================================================================

-- STEP 1: Check what she ACTUALLY received
SELECT 
  type,
  amount,
  description,
  created_at,
  metadata
FROM credit_transactions
WHERE user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ'
  AND amount > 0  -- Only credit additions
ORDER BY created_at ASC;

-- STEP 2: Check what she SPENT
SELECT 
  type,
  amount,
  description,
  created_at
FROM credit_transactions
WHERE user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ'
  AND amount < 0  -- Only deductions
ORDER BY created_at ASC;

-- STEP 3: Current balance verification
SELECT 
  credits,
  wallet_balance,
  total_generated
FROM users
WHERE clerk_user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ';

-- ============================================================================
-- CALCULATION SCENARIOS:
-- ============================================================================

-- Scenario A: OLD conversion (migration 119 - keeps $1 in wallet)
--   Deposit $2 → $1 stays in wallet → only $1 converts
--   $1 / 0.035 = 28.57 → 28 credits
--   + 20 from decrypt = 48 credits total
--   - 6 used = 42 credits remaining
--   Expected: 42 credits ❌ (actual: 45)

-- Scenario B: NEW conversion (migration 123 - converts ALL)
--   Deposit $2 → ALL $2 converts
--   $2 / 0.035 = 57.14 → 57 credits
--   + 20 from decrypt = 77 credits total
--   - 6 used = 71 credits remaining
--   Expected: 71 credits ❌ (actual: 45)

-- Scenario C: ACTUAL (based on current = 45, used = 6)
--   45 + 6 = 51 credits total received
--   If she got 20 from decrypt, then:
--   51 - 20 = 31 credits from deposit
--   31 credits × $0.035 = $1.085 deposited
--   This doesn't match $2 deposit! ❌

-- Scenario D: DOUBLE DEPOSIT BUG (from previous investigation)
--   She had 159 credits before correction
--   Expected after correction: 77 credits
--   Excess clawed back: 82 credits
--   But if only 6 was used, not 32, then:
--   Correct balance should be: 77 - 6 = 71 credits
--   Actual balance: 45 credits
--   Missing: 71 - 45 = 26 credits ❌

-- ============================================================================
-- LIKELY ISSUE: Wrong correction amount OR transactions not showing all generations
-- ============================================================================

-- Check if correction was applied
SELECT 
  type,
  amount,
  description,
  created_at,
  metadata
FROM credit_transactions
WHERE user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ'
  AND type = 'credit_refund'
ORDER BY created_at DESC;

-- Sum ALL transactions to verify balance
SELECT 
  SUM(amount) AS net_credits,
  COUNT(*) AS transaction_count
FROM credit_transactions
WHERE user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ';

-- ============================================================================
-- ACTION: Run this to see ACTUAL transaction history, then we can calculate
-- the correct correction amount.
-- ============================================================================
