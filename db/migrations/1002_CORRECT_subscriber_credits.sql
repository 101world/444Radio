-- ============================================================================
-- CORRECT SUBSCRIBER CREDITS - Based on Actual Pricing Plans
-- Date: 2026-01-12
-- Run this IMMEDIATELY to fix incorrect credit amounts
-- ============================================================================
-- 
-- OFFICIAL PRICING (from PLAN_CONFIG.ts):
-- - Creator Plan: 100 credits/month
-- - Pro Plan: 600 credits/month
-- - Studio Plan: 1,500 credits/month
--
-- Previously gave 999,999 (unlimited) - THIS WAS WRONG!
-- Subscribers get monthly credits, not unlimited.
-- ============================================================================

BEGIN;

-- STEP 1: Show current incorrect state
SELECT 
  clerk_user_id,
  username,
  email,
  credits as current_credits,
  subscription_status,
  subscription_plan,
  CASE 
    WHEN subscription_plan LIKE '%creator%' THEN 'Should be 100 credits'
    WHEN subscription_plan LIKE '%pro%' THEN 'Should be 600 credits'
    WHEN subscription_plan LIKE '%studio%' THEN 'Should be 1,500 credits'
    ELSE 'Unknown plan'
  END as correct_amount
FROM public.users
WHERE subscription_status = 'active'
ORDER BY subscription_plan, username;

-- STEP 2: Set correct credits based on subscription plan
-- Creator Plan: 100 credits/month (plan_S2DGVK6J270rtt or plan_S2DJv0bFnWoNLS)
UPDATE public.users
SET 
  credits = 100,
  updated_at = NOW()
WHERE 
  subscription_status = 'active'
  AND (
    subscription_plan LIKE '%creator%' 
    OR subscription_plan IN ('plan_S2DGVK6J270rtt', 'plan_S2DJv0bFnWoNLS')
  );

-- Pro Plan: 600 credits/month (plan_S2DHUGo7n1m6iv or plan_S2DNEvy1YzYWNh)
UPDATE public.users
SET 
  credits = 600,
  updated_at = NOW()
WHERE 
  subscription_status = 'active'
  AND (
    subscription_plan LIKE '%pro%'
    OR subscription_plan IN ('plan_S2DHUGo7n1m6iv', 'plan_S2DNEvy1YzYWNh')
  );

-- Studio Plan: 1,500 credits/month (plan_S2DIdCKNcV6TtA or plan_S2DOABOeGedJHk)
UPDATE public.users
SET 
  credits = 1500,
  updated_at = NOW()
WHERE 
  subscription_status = 'active'
  AND (
    subscription_plan LIKE '%studio%'
    OR subscription_plan IN ('plan_S2DIdCKNcV6TtA', 'plan_S2DOABOeGedJHk')
  );

-- STEP 3: Verify corrections
SELECT 
  CASE 
    WHEN subscription_plan LIKE '%creator%' THEN 'Creator'
    WHEN subscription_plan LIKE '%pro%' THEN 'Pro'
    WHEN subscription_plan LIKE '%studio%' THEN 'Studio'
    ELSE 'Unknown'
  END as plan_type,
  COUNT(*) as subscriber_count,
  AVG(credits) as avg_credits,
  MIN(credits) as min_credits,
  MAX(credits) as max_credits,
  CASE 
    WHEN subscription_plan LIKE '%creator%' THEN '✓ Should be 100'
    WHEN subscription_plan LIKE '%pro%' THEN '✓ Should be 600'
    WHEN subscription_plan LIKE '%studio%' THEN '✓ Should be 1,500'
    ELSE '❓ Unknown'
  END as expected_credits
FROM public.users
WHERE subscription_status = 'active'
GROUP BY 
  CASE 
    WHEN subscription_plan LIKE '%creator%' THEN 'Creator'
    WHEN subscription_plan LIKE '%pro%' THEN 'Pro'
    WHEN subscription_plan LIKE '%studio%' THEN 'Studio'
    ELSE 'Unknown'
  END,
  CASE 
    WHEN subscription_plan LIKE '%creator%' THEN '✓ Should be 100'
    WHEN subscription_plan LIKE '%pro%' THEN '✓ Should be 600'
    WHEN subscription_plan LIKE '%studio%' THEN '✓ Should be 1,500'
    ELSE '❓ Unknown'
  END
ORDER BY plan_type;

-- STEP 4: Show all subscribers with corrected credits
SELECT 
  username,
  email,
  credits,
  subscription_status,
  subscription_plan,
  CASE 
    WHEN subscription_plan LIKE '%creator%' THEN 'Creator (100 credits/month)'
    WHEN subscription_plan LIKE '%pro%' THEN 'Pro (600 credits/month)'
    WHEN subscription_plan LIKE '%studio%' THEN 'Studio (1,500 credits/month)'
    ELSE 'Unknown Plan'
  END as plan_description,
  updated_at
FROM public.users
WHERE subscription_status = 'active'
ORDER BY 
  CASE 
    WHEN subscription_plan LIKE '%creator%' THEN 1
    WHEN subscription_plan LIKE '%pro%' THEN 2
    WHEN subscription_plan LIKE '%studio%' THEN 3
    ELSE 4
  END,
  username;

COMMIT;

-- ============================================================================
-- IMPORTANT NOTES
-- ============================================================================
-- 
-- 1. This corrects the wrong "unlimited" (999,999) credits given earlier
-- 2. Credits are now aligned with actual pricing plans
-- 3. Monthly credits reset is handled by your Razorpay webhook
-- 4. Free users should have 20 credits (not affected by this fix)
-- 
-- PRICING REFERENCE:
-- - Creator: ₹450/month or ₹4,420/year → 100 credits/month
-- - Pro: ₹1,355/month or ₹13,090/year → 600 credits/month
-- - Studio: ₹3,160/month or ₹30,330/year → 1,500 credits/month
-- ============================================================================
