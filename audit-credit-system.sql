-- ============================================================================
-- Comprehensive Credit Audit: Check for Leaks, Bonuses, Free Distribution
-- Date: 2026-02-16
--
-- This script checks all possible credit-granting mechanisms to ensure
-- no unauthorized distributions are occurring.
-- ============================================================================

-- ══════════════════════════════════════════════════════════════════════════
-- 1. CHECK ALL USERS WITH CREDITS (should only have wallet deposits + decrypt)
-- ══════════════════════════════════════════════════════════════════════════
SELECT 
  u.clerk_user_id,
  u.username,
  u.email,
  u.credits,
  u.wallet_balance,
  u.total_generated,
  u.created_at,
  u.subscription_status,
  u.subscription_plan
FROM users u
WHERE u.credits > 0
ORDER BY u.credits DESC
LIMIT 50;

-- ══════════════════════════════════════════════════════════════════════════
-- 2. CHECK RECENT CREDIT AWARDS (last 7 days)
-- ══════════════════════════════════════════════════════════════════════════
SELECT 
  ct.user_id,
  u.username,
  ct.type,
  ct.amount,
  ct.balance_after,
  ct.status,
  ct.description,
  ct.created_at,
  ct.metadata->>'source' AS source,
  ct.metadata->>'credit_source' AS credit_source
FROM credit_transactions ct
JOIN users u ON u.clerk_user_id = ct.user_id
WHERE ct.amount > 0
  AND ct.created_at > NOW() - INTERVAL '7 days'
ORDER BY ct.created_at DESC
LIMIT 100;

-- ══════════════════════════════════════════════════════════════════════════
-- 3. COUNT CREDIT SOURCES BY TYPE (all time)
-- ══════════════════════════════════════════════════════════════════════════
SELECT 
  type,
  COUNT(*) AS transaction_count,
  SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS total_credits_added,
  SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS total_credits_deducted,
  SUM(amount) AS net_credits
FROM credit_transactions
GROUP BY type
ORDER BY type;

-- ══════════════════════════════════════════════════════════════════════════
-- 4. CHECK FOR SUSPICIOUS PATTERNS (multiple decrypt claims, etc.)
-- ══════════════════════════════════════════════════════════════════════════

-- Users who claimed decrypt code multiple times (should be ZERO)
SELECT 
  clerk_user_id,
  code,
  COUNT(*) AS claim_count,
  SUM(credits_awarded) AS total_credits,
  MIN(redeemed_at) AS first_claim,
  MAX(redeemed_at) AS last_claim
FROM code_redemptions
WHERE code = 'FREE THE MUSIC'
GROUP BY clerk_user_id, code
HAVING COUNT(*) > 1
ORDER BY claim_count DESC;

-- ══════════════════════════════════════════════════════════════════════════
-- 5. CHECK SUBSCRIPTION BONUSES (should be ZERO new ones)
-- ══════════════════════════════════════════════════════════════════════════
SELECT 
  ct.user_id,
  u.username,
  ct.amount,
  ct.balance_after,
  ct.description,
  ct.created_at,
  ct.metadata
FROM credit_transactions ct
JOIN users u ON u.clerk_user_id = ct.user_id
WHERE ct.type = 'subscription_bonus'
  AND ct.created_at > '2026-02-15'  -- After wallet system deployed
ORDER BY ct.created_at DESC;

-- ══════════════════════════════════════════════════════════════════════════
-- 6. CHECK WALLET DEPOSITS vs CREDITS GRANTED
-- ══════════════════════════════════════════════════════════════════════════

-- For each wallet deposit, verify credits granted match expected amount
WITH deposits AS (
  SELECT 
    user_id,
    created_at,
    (metadata->>'deposit_usd')::NUMERIC AS deposit_usd,
    (metadata->>'razorpay_payment_id')::TEXT AS payment_id,
    id AS deposit_txn_id
  FROM credit_transactions
  WHERE type = 'wallet_deposit'
    AND created_at > '2026-02-15'
),
conversions AS (
  SELECT 
    user_id,
    created_at,
    amount AS credits_granted,
    (metadata->>'usd_converted')::NUMERIC AS usd_converted,
    (metadata->>'razorpay_payment_id')::TEXT AS payment_id,
    id AS conversion_txn_id
  FROM credit_transactions
  WHERE type = 'wallet_conversion'
    AND created_at > '2026-02-15'
)
SELECT 
  d.user_id,
  u.username,
  d.deposit_usd,
  d.payment_id,
  c.credits_granted,
  c.usd_converted,
  -- Expected credits: floor(deposit_usd / 0.035)
  FLOOR(d.deposit_usd / 0.035) AS expected_credits,
  -- Check if correct
  CASE 
    WHEN c.credits_granted = FLOOR(d.deposit_usd / 0.035) THEN '✅ CORRECT'
    ELSE '❌ MISMATCH'
  END AS status,
  d.created_at AS deposit_time,
  c.created_at AS conversion_time
FROM deposits d
LEFT JOIN conversions c ON c.user_id = d.user_id 
  AND c.payment_id = d.payment_id
JOIN users u ON u.clerk_user_id = d.user_id
ORDER BY d.created_at DESC;

-- ══════════════════════════════════════════════════════════════════════════
-- 7. CHECK FOR ORPHANED CREDITS (credits without source transactions)
-- ══════════════════════════════════════════════════════════════════════════

-- Users with credits but no credit_transactions records explaining the source
WITH user_credits AS (
  SELECT 
    clerk_user_id,
    username,
    credits
  FROM users
  WHERE credits > 0
),
txn_summary AS (
  SELECT 
    user_id,
    SUM(amount) AS net_credits_from_txns
  FROM credit_transactions
  GROUP BY user_id
)
SELECT 
  uc.clerk_user_id,
  uc.username,
  uc.credits AS current_credits,
  COALESCE(ts.net_credits_from_txns, 0) AS credits_from_transactions,
  uc.credits - COALESCE(ts.net_credits_from_txns, 0) AS discrepancy
FROM user_credits uc
LEFT JOIN txn_summary ts ON ts.user_id = uc.clerk_user_id
WHERE uc.credits != COALESCE(ts.net_credits_from_txns, 0)
ORDER BY ABS(uc.credits - COALESCE(ts.net_credits_from_txns, 0)) DESC
LIMIT 20;

-- ══════════════════════════════════════════════════════════════════════════
-- 8. VERIFY DEDUCT_CREDITS ENFORCEMENT ($1 wallet gate)
-- ══════════════════════════════════════════════════════════════════════════

-- Find users who generated content with wallet_balance < $1 (should be ZERO)
SELECT 
  ct.user_id,
  u.username,
  u.wallet_balance,
  ct.type,
  ct.amount,
  ct.created_at,
  ct.description
FROM credit_transactions ct
JOIN users u ON u.clerk_user_id = ct.user_id
WHERE ct.type LIKE 'generation_%'
  AND ct.amount < 0
  AND ct.created_at > '2026-02-15'  -- After $1 gate deployed
  AND u.wallet_balance < 1.00
ORDER BY ct.created_at DESC
LIMIT 20;

-- ══════════════════════════════════════════════════════════════════════════
-- 9. CHECK FOR FAILED GENERATIONS THAT STILL DEDUCTED CREDITS
-- ══════════════════════════════════════════════════════════════════════════
SELECT 
  user_id,
  u.username,
  type,
  amount,
  balance_after,
  status,
  description,
  created_at,
  metadata
FROM credit_transactions ct
JOIN users u ON u.clerk_user_id = ct.user_id
WHERE type LIKE 'generation_%'
  AND status = 'failed'
  AND amount < 0  -- Credits were deducted despite failure
  AND created_at > '2026-02-10'
ORDER BY created_at DESC;

-- ══════════════════════════════════════════════════════════════════════════
-- 10. SUMMARY: Total Credits in System
-- ══════════════════════════════════════════════════════════════════════════
SELECT 
  'Total Credits in User Accounts' AS metric,
  SUM(credits) AS value
FROM users
UNION ALL
SELECT 
  'Total Credits Granted (all time)' AS metric,
  SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS value
FROM credit_transactions
UNION ALL
SELECT 
  'Total Credits Deducted (all time)' AS metric,
  SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS value
FROM credit_transactions
UNION ALL
SELECT 
  'Net Credits (should match Total in Accounts)' AS metric,
  SUM(amount) AS value
FROM credit_transactions;

-- ============================================================================
-- Expected Results:
-- - Section 4: ZERO multiple decrypt claims
-- - Section 5: ZERO subscription bonuses after 2026-02-15
-- - Section 6: ALL deposits match expected credit calculation
-- - Section 7: Minimal/zero discrepancy (early users may have some)
-- - Section 8: ZERO generations with wallet < $1
-- - Section 9: ZERO failed generations that deducted credits
-- - Section 10: Net credits should match total in accounts
-- ============================================================================
