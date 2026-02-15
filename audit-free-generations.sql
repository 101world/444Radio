-- ============================================================================
-- AUDIT: Find users who generated content without credits being deducted
--
-- The bug: all generation routes deducted credits AFTER generation and
-- ignored failures. Combined with the $1 wallet gate in deduct_credits(),
-- users could generate for free when the deduction returned success=false.
--
-- This query finds all failed deductions (status='failed') that correspond
-- to actual generations, showing how many free credits each user consumed.
--
-- Run this AFTER applying migration 120 (which removes the wallet gate).
-- ============================================================================

-- 1. See all failed deductions (these are the free generations)
SELECT 
  user_id,
  type,
  amount,
  description,
  status,
  created_at,
  metadata
FROM credit_transactions
WHERE status = 'failed'
  AND amount < 0   -- Only actual deduction attempts (not $0 failed-gen logs)
ORDER BY created_at DESC;

-- 2. Summary: total free credits consumed per user
SELECT 
  user_id,
  COUNT(*) AS free_generations,
  SUM(ABS(amount)) AS total_free_credits,
  MIN(created_at) AS first_free_gen,
  MAX(created_at) AS last_free_gen
FROM credit_transactions
WHERE status = 'failed'
  AND amount < 0
GROUP BY user_id
ORDER BY total_free_credits DESC;

-- 3. CLAWBACK: Deduct the stolen credits from each user's balance
-- ⚠️  REVIEW the output of query #2 first before running this!
-- This sets credits to max(0, credits - stolen) for each user.
/*
UPDATE users u
SET credits = GREATEST(0, credits - stolen.total_free_credits::int)
FROM (
  SELECT 
    user_id,
    SUM(ABS(amount)) AS total_free_credits
  FROM credit_transactions
  WHERE status = 'failed'
    AND amount < 0
  GROUP BY user_id
) stolen
WHERE u.clerk_user_id = stolen.user_id
  AND stolen.total_free_credits > 0;
*/

-- 4. Log the clawback transactions (run after the UPDATE above)
/*
INSERT INTO credit_transactions (user_id, amount, balance_after, type, status, description, metadata)
SELECT 
  stolen.user_id,
  -stolen.total_free_credits::int,
  GREATEST(0, u.credits - stolen.total_free_credits::int),
  'credit_clawback',
  'success',
  'Clawback for free generations due to deduction bug (pre-2026-02-16 fix)',
  jsonb_build_object(
    'free_generations', stolen.free_gen_count,
    'total_free_credits', stolen.total_free_credits,
    'bug', 'deduct_after_generation_ignored_failure'
  )
FROM (
  SELECT 
    user_id,
    COUNT(*) AS free_gen_count,
    SUM(ABS(amount)) AS total_free_credits
  FROM credit_transactions
  WHERE status = 'failed'
    AND amount < 0
  GROUP BY user_id
) stolen
JOIN users u ON u.clerk_user_id = stolen.user_id
WHERE stolen.total_free_credits > 0;
*/
