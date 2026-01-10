-- Fix subscription_plan field to show plan name instead of subscription ID
-- This updates existing records to extract the plan type from subscription_id

UPDATE users
SET subscription_plan = CASE
    -- Studio plans
    WHEN subscription_id LIKE '%studio%' OR subscription_id LIKE '%S2DI%' OR subscription_id LIKE '%S2DO%' THEN 'studio'
    -- Pro plans
    WHEN subscription_id LIKE '%pro%' OR subscription_id LIKE '%S2DH%' OR subscription_id LIKE '%S2DN%' THEN 'pro'
    -- Creator plans (default)
    ELSE 'creator'
END
WHERE subscription_status = 'active'
AND (subscription_plan LIKE 'sub_%' OR subscription_plan LIKE 'plan_%');

-- Show the results
SELECT 
    clerk_user_id,
    subscription_status,
    subscription_plan,
    subscription_id,
    credits
FROM users
WHERE subscription_status = 'active';
