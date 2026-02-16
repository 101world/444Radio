-- Check if wallet_deposit transactions are being logged
-- Run in Supabase SQL Editor

-- 1. Check if constraint allows wallet_deposit and wallet_conversion
SELECT
  constraint_name,
  check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'credit_transactions_type_check';

-- 2. Count wallet_deposit transactions by user
SELECT
  user_id,
  COUNT(*) as deposit_count,
  SUM(amount) as total_credits_from_deposits,
  MIN(created_at) as first_deposit,
  MAX(created_at) as last_deposit
FROM credit_transactions
WHERE type = 'wallet_deposit'
GROUP BY user_id
ORDER BY deposit_count DESC;

-- 3. Recent wallet_deposit transactions (last 20)
SELECT
  user_id,
  amount,
  balance_after,
  description,
  metadata->>'deposit_usd' as deposit_usd,
  metadata->>'razorpay_payment_id' as payment_id,
  created_at
FROM credit_transactions
WHERE type = 'wallet_deposit'
ORDER BY created_at DESC
LIMIT 20;

-- 4. Check for failed wallet_deposit transactions
SELECT
  user_id,
  amount,
  status,
  description,
  metadata,
  created_at
FROM credit_transactions
WHERE type = 'wallet_deposit'
  AND status = 'failed'
ORDER BY created_at DESC
LIMIT 10;

-- 5. Compare wallet_deposit vs wallet_conversion counts
SELECT
  type,
  COUNT(*) as count,
  SUM(amount) as total_credits
FROM credit_transactions
WHERE type IN ('wallet_deposit', 'wallet_conversion')
GROUP BY type;

-- 6. Check if there are any recent transactions at all (any type)
SELECT
  type,
  COUNT(*) as count,
  MAX(created_at) as most_recent
FROM credit_transactions
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY type
ORDER BY count DESC;

-- 7. Check specific user's wallet_deposit history (replace with actual clerk_user_id)
-- REPLACE 'user_2xxxxxxxxxxxxx' with the actual Clerk user ID
/*
SELECT
  id,
  amount,
  balance_after,
  type,
  status,
  description,
  metadata,
  created_at
FROM credit_transactions
WHERE user_id = 'user_2xxxxxxxxxxxxx'
  AND type IN ('wallet_deposit', 'wallet_conversion')
ORDER BY created_at DESC;
*/
