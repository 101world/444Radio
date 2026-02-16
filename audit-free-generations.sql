-- ============================================================================
-- AUDIT: Find users who generated content without credits being deducted
--
-- The bug: all generation routes deducted credits AFTER generation and
-- ignored failures. Combined with the $1 wallet gate in deduct_credits(),
-- users could generate for free when the deduction returned success=false.
--
-- Result: 1 user, 3 free generations, 5 free credits total.
--   user_34StnaXDJ3yZTYmz1Wmv3sYcqcB — 5 credits, 2026-02-15
--
-- POLICY: Everyone MUST have $1+ in wallet to generate. No exceptions.
--         The $1 wallet gate in deduct_credits() (migration 119) stays.
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
  AND amount < 0
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

-- 3. CLAWBACK: Deduct the 5 stolen credits from user_34StnaXDJ3yZTYmz1Wmv3sYcqcB
UPDATE users
SET credits = GREATEST(0, credits - 5)
WHERE clerk_user_id = 'user_34StnaXDJ3yZTYmz1Wmv3sYcqcB';

-- 4. Log the clawback transaction
INSERT INTO credit_transactions (user_id, amount, balance_after, type, status, description, metadata)
SELECT
  'user_34StnaXDJ3yZTYmz1Wmv3sYcqcB',
  -5,
  GREATEST(0, credits - 5),
  'credit_refund',
  'success',
  'Clawback: 5 free credits from 3 generations (deduction bug pre-2026-02-16)',
  '{"free_generations": 3, "total_free_credits": 5, "bug": "deduct_after_generation_ignored_failure"}'::jsonb
FROM users
WHERE clerk_user_id = 'user_34StnaXDJ3yZTYmz1Wmv3sYcqcB';
