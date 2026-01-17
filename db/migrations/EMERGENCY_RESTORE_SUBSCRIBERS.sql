-- ============================================================================
-- EMERGENCY: Restore Subscriber Credits
-- Date: 2026-01-12
-- Run this IMMEDIATELY if subscribers lost their credits
-- ============================================================================

BEGIN;

-- Show affected subscribers BEFORE fix
SELECT 
  clerk_user_id,
  username,
  email,
  credits as current_credits,
  subscription_status,
  subscription_plan,
  'NEEDS RESTORATION' as status
FROM public.users
WHERE 
  subscription_status = 'active'
  AND credits < 999999;  -- Adjust if your subscriber limit is different

-- Restore unlimited credits to all active subscribers
UPDATE public.users
SET 
  credits = 999999,  -- Unlimited credits for subscribers
  updated_at = NOW()
WHERE subscription_status = 'active';

-- Show restoration results
SELECT 
  COUNT(*) as subscribers_restored,
  SUM(CASE WHEN credits = 999999 THEN 1 ELSE 0 END) as now_unlimited,
  'Subscribers restored to unlimited credits' as action
FROM public.users
WHERE subscription_status = 'active';

-- Verify all subscribers now have unlimited credits
SELECT 
  username,
  email,
  credits,
  subscription_status,
  subscription_plan,
  updated_at
FROM public.users
WHERE subscription_status = 'active'
ORDER BY username;

COMMIT;

-- ============================================================================
-- POST-RESTORATION VERIFICATION
-- ============================================================================

-- Count users by type and credit level
SELECT 
  CASE 
    WHEN subscription_status = 'active' THEN 'Active Subscriber'
    WHEN subscription_status IS NOT NULL THEN 'Inactive Subscriber'
    ELSE 'Free User'
  END as user_type,
  CASE 
    WHEN credits >= 999999 THEN 'Unlimited'
    WHEN credits >= 100 THEN 'High'
    WHEN credits >= 20 THEN 'Normal'
    ELSE 'Low'
  END as credit_tier,
  COUNT(*) as user_count,
  AVG(credits) as avg_credits
FROM public.users
GROUP BY 
  CASE 
    WHEN subscription_status = 'active' THEN 'Active Subscriber'
    WHEN subscription_status IS NOT NULL THEN 'Inactive Subscriber'
    ELSE 'Free User'
  END,
  CASE 
    WHEN credits >= 999999 THEN 'Unlimited'
    WHEN credits >= 100 THEN 'High'
    WHEN credits >= 20 THEN 'Normal'
    ELSE 'Low'
  END
ORDER BY user_type, credit_tier DESC;
