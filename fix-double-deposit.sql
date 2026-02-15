-- ============================================================================
-- FIX: Double-deposit bug — verify route + payment.captured webhook both
-- deposited + converted credits for the same payment.
--
-- Run this diagnostic FIRST to see exactly what happened for a user,
-- then run the correction after verifying.
-- ============================================================================

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 1: DIAGNOSTIC — View all recent wallet/credit transactions for the user
-- Replace 'USER_CLERK_ID' with the actual clerk_user_id
-- ══════════════════════════════════════════════════════════════════════════════

SELECT
  id,
  type,
  status,
  amount,
  balance_after,
  description,
  metadata->>'credit_source' AS source,
  metadata->>'event_type' AS event_type,
  metadata->>'deposit_usd' AS deposit_usd,
  metadata->>'credits_added' AS credits_added,
  metadata->>'order_id' AS order_id,
  metadata->>'razorpay_id' AS razorpay_id,
  metadata->>'razorpay_payment_id' AS razorpay_payment_id,
  metadata->>'wallet_balance' AS wallet_balance,
  metadata->>'source' AS rpc_source,
  created_at
FROM credit_transactions
WHERE user_id = 'USER_CLERK_ID'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 2: Check current user state
-- ══════════════════════════════════════════════════════════════════════════════

SELECT
  clerk_user_id,
  credits,
  wallet_balance,
  email,
  updated_at
FROM users
WHERE clerk_user_id = 'USER_CLERK_ID';

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 3: CORRECTION — After reviewing the transactions above, calculate the
-- excess credits and deduct them.
--
-- For a $2 deposit with $1 kept in wallet:
--   Correct credits = FLOOR(($2 - $1) / $0.035) = 28 credits
--   OR if wallet already had $1+: FLOOR($2 / $0.035) = 57 credits
--   (Depends on starting wallet balance)
--
-- User currently has 167 credits (20 old + 147 new).
-- If correct amount was 28 new credits: should have 48 → excess = 119
-- If correct amount was 57 new credits: should have 77 → excess = 90
--
-- Adjust EXCESS_CREDITS below after reviewing actual transactions.
-- ══════════════════════════════════════════════════════════════════════════════

-- Calculate excess from actual transactions:
-- Count distinct order_ids with wallet_deposit type and success status
-- Each order should have produced credits only ONCE

-- Uncomment and adjust once you know the exact excess:
/*
UPDATE users
SET credits = credits - EXCESS_CREDITS,
    wallet_balance = wallet_balance - EXCESS_WALLET,
    updated_at = NOW()
WHERE clerk_user_id = 'USER_CLERK_ID';

INSERT INTO credit_transactions (user_id, amount, balance_after, type, status, description, metadata)
VALUES (
  'USER_CLERK_ID',
  -EXCESS_CREDITS,
  (SELECT credits FROM users WHERE clerk_user_id = 'USER_CLERK_ID'),
  'credit_refund',
  'success',
  'Correction: double-deposit bug removed excess credits',
  '{"reason": "verify_route_and_payment_captured_both_deposited", "bug_fix": true}'::jsonb
);
*/
