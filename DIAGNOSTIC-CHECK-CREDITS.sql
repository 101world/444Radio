-- ============================================================================
-- DIAGNOSTIC: Check why users got 72 credits instead of 24
-- ============================================================================

-- 1. Check how many times each user got the upgrade
SELECT 
  user_id,
  COUNT(*) as times_awarded,
  SUM(amount) as total_credits_received,
  MIN(created_at) as first_award,
  MAX(created_at) as last_award
FROM credit_transactions
WHERE description LIKE '%Free the Music%'
  AND metadata->>'campaign' = 'free_the_music'
GROUP BY user_id
ORDER BY times_awarded DESC;

-- 2. Check code_redemptions for duplicates
SELECT 
  clerk_user_id,
  COUNT(*) as redemption_count
FROM code_redemptions
WHERE code = 'FREE THE MUSIC'
GROUP BY clerk_user_id
HAVING COUNT(*) > 1
ORDER BY redemption_count DESC;

-- 3. Check current free_credits for affected users
SELECT 
  clerk_user_id,
  credits as paid_credits,
  free_credits,
  (credits + COALESCE(free_credits, 0)) as total
FROM users
WHERE clerk_user_id IN (
  SELECT DISTINCT user_id 
  FROM credit_transactions 
  WHERE description LIKE '%Free the Music%'
)
ORDER BY free_credits DESC
LIMIT 20;
