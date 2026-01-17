-- ============================================================================
-- SAFE CREDIT RESET - Protects Subscribers
-- Date: 2026-01-12
-- WARNING: Run this in SQL Editor, review results before committing
-- ============================================================================

-- ============================================================================
-- STEP 1: DIAGNOSTIC - Check who would be affected
-- ============================================================================

-- Check current credit distribution
SELECT 
  CASE 
    WHEN subscription_status = 'active' THEN 'Active Subscriber'
    WHEN subscription_status IS NOT NULL THEN 'Inactive Subscriber'
    ELSE 'Free User'
  END as user_type,
  COUNT(*) as count,
  AVG(credits) as avg_credits,
  MIN(credits) as min_credits,
  MAX(credits) as max_credits
FROM public.users
GROUP BY 
  CASE 
    WHEN subscription_status = 'active' THEN 'Active Subscriber'
    WHEN subscription_status IS NOT NULL THEN 'Inactive Subscriber'
    ELSE 'Free User'
  END;

-- ============================================================================
-- STEP 2: IDENTIFY AFFECTED USERS
-- List users who would have credits reset (excluding subscribers)
-- ============================================================================

SELECT 
  clerk_user_id,
  username,
  email,
  credits,
  subscription_status,
  subscription_plan,
  created_at
FROM public.users
WHERE 
  -- Only non-subscribers
  (subscription_status IS NULL OR subscription_status != 'active')
  -- Who have credits below or above 20 (need reset)
  AND credits != 20
ORDER BY credits DESC;

-- ============================================================================
-- STEP 3: SAFE CREDIT RESET (ONLY for free users)
-- Uncomment to execute after reviewing above results
-- ============================================================================

-- ROLLBACK; -- Uncommenting this line makes it a dry-run (no changes)

BEGIN;

-- Reset credits ONLY for free (non-subscribed) users
UPDATE public.users
SET credits = 20, updated_at = NOW()
WHERE 
  -- Critical: Only affect non-subscribers
  (subscription_status IS NULL OR subscription_status != 'active')
  -- And credits are not already 20
  AND credits != 20;

-- Show what was changed
SELECT 
  COUNT(*) as users_reset,
  'Free users reset to 20 credits' as action
FROM public.users
WHERE 
  (subscription_status IS NULL OR subscription_status != 'active')
  AND credits = 20;

COMMIT;

-- ============================================================================
-- STEP 4: RESTORE SUBSCRIBER CREDITS (Emergency recovery)
-- If subscribers were accidentally reset, use this
-- ============================================================================

-- Restore subscribers to unlimited credits (or your preferred amount)
-- BEGIN;
-- 
-- UPDATE public.users
-- SET 
--   credits = 999999,  -- Unlimited credits for subscribers
--   updated_at = NOW()
-- WHERE subscription_status = 'active';
-- 
-- COMMIT;

-- ============================================================================
-- STEP 5: VERIFICATION
-- ============================================================================

-- Verify subscribers were not affected
SELECT 
  username,
  email,
  credits,
  subscription_status,
  subscription_plan
FROM public.users
WHERE subscription_status = 'active'
ORDER BY credits ASC
LIMIT 10;

-- Verify free users have 20 credits
SELECT 
  COUNT(*) as free_users_with_20_credits
FROM public.users
WHERE 
  (subscription_status IS NULL OR subscription_status != 'active')
  AND credits = 20;
