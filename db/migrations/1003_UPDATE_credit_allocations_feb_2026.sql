-- Migration: Update Credit Allocations (February 2026)
-- Purpose: Adjust credit costs to proper retail pricing ($0.03/credit)
--
-- NEW PRICING (Price / $0.03 per credit):
-- Creator: $5 → 167 credits/month (was 100) = +67 bonus credits 
-- Pro: $16 → 535 credits/month (was 600) = NO CHANGE (they keep 600)
-- Studio: $37 → 1235 credits/month (was 1500) = NO CHANGE (they keep 1500)
--
-- 🔒 NEVER REDUCE POLICY: We NEVER take credits away from existing subscribers
-- - Creator subscribers get +67 credits as a bonus (new rate is higher)
-- - Pro/Studio subscribers keep their current higher allocation (grandfathered)
-- - New subscribers from now on get the new allocation

BEGIN;

-- 1. ONLY top up Creator subscribers (they're getting MORE credits now)
UPDATE users
SET 
  credits = credits + 67,
  updated_at = NOW()
WHERE 
  subscription_status = 'active'
  AND (
    subscription_plan ILIKE '%creator%' 
    OR subscription_plan = 'plan_S2DGVK6J270rtt'  -- Razorpay Creator monthly plan ID
  );

-- 2. Log the adjustment (skip if no admin_logs table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'admin_logs') THEN
    INSERT INTO admin_logs (action, details, created_at)
    SELECT 
      'credit_allocation_update',
      jsonb_build_object(
        'reason', 'feb_2026_pricing_update',
        'plan', 'creator',
        'adjustment', '+67 credits',
        'policy', 'never_reduce_only_add',
        'users_affected', COUNT(*)
      ),
      NOW()
    FROM users
    WHERE 
      subscription_status = 'active'
      AND (
        subscription_plan ILIKE '%creator%' 
        OR subscription_plan = 'plan_S2DGVK6J270rtt'
      );
  END IF;
END $$;

COMMIT;

-- ✅ Verification: Check how many users got the bonus
-- SELECT 
--   'Creator subscribers who got +67 credits bonus' as description,
--   COUNT(*) as user_count
-- FROM users 
-- WHERE subscription_status = 'active' 
--   AND (subscription_plan ILIKE '%creator%' OR subscription_plan = 'plan_S2DGVK6J270rtt');
