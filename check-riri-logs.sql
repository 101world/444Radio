-- ============================================================================
-- Check riri's transaction history
-- User: riri (user_34LKhAX7aYSnMboQLn5S8vVbzoQ)
-- 
-- Expected: 20 initial + 57 from $2 purchase = 77 credits
-- Current state (per user): 45 credits
-- Generations used: 77 - 45 = 32 credits
-- ============================================================================

-- Step 1: Check current user state
SELECT 
  clerk_user_id,
  username,
  email,
  credits,
  wallet_balance,
  total_generated,
  created_at,
  updated_at
FROM users
WHERE clerk_user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ';

-- Step 2: Get all credit transactions for riri
SELECT 
  id,
  type,
  amount,
  balance_after,
  status,
  description,
  created_at,
  metadata
FROM credit_transactions
WHERE user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ'
ORDER BY created_at ASC;

-- Step 3: Count credit sources
SELECT 
  type,
  COUNT(*) AS transaction_count,
  SUM(amount) AS total_amount
FROM credit_transactions
WHERE user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ'
GROUP BY type
ORDER BY type;

-- Step 4: Check for any deposits
SELECT 
  id,
  type,
  amount,
  balance_after,
  status,
  description,
  created_at,
  metadata->>'deposit_usd' AS deposit_usd,
  metadata->>'razorpay_payment_id' AS payment_id,
  metadata->>'credits_added' AS credits_added
FROM credit_transactions
WHERE user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ'
  AND type IN ('wallet_deposit', 'wallet_conversion')
ORDER BY created_at DESC;

-- Step 5: Check for decrypt code redemption
SELECT 
  id,
  code,
  redeemed_at,
  credits_awarded,
  redemption_count
FROM code_redemptions
WHERE clerk_user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ';

-- Step 6: Sum up all credit additions vs deductions
SELECT 
  'Total Credits Added' AS description,
  SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS value
FROM credit_transactions
WHERE user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ'
UNION ALL
SELECT 
  'Total Credits Deducted' AS description,
  SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS value
FROM credit_transactions
WHERE user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ'
UNION ALL
SELECT 
  'Net Credits (Should Match Current)' AS description,
  SUM(amount) AS value
FROM credit_transactions
WHERE user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ';

-- Step 7: Check for any generation records
SELECT 
  COUNT(*) AS generation_count,
  SUM(ABS(amount)) AS total_credits_spent
FROM credit_transactions
WHERE user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ'
  AND amount < 0
  AND type LIKE 'generation_%';

-- ============================================================================
-- Analysis expected output:
-- - 20 credits from decrypt code (type: credit_award or code_claim)
-- - 57 credits from $2 wallet conversion (type: wallet_conversion)
-- - Negative amounts showing generations used
-- - Current balance: 45 credits
-- - Total generations: 32 credits worth
-- ============================================================================
