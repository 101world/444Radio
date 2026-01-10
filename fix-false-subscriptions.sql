-- Check what subscription_status values exist in database
SELECT 
  subscription_status,
  COUNT(*) as user_count,
  STRING_AGG(DISTINCT email, ', ') as sample_emails
FROM users
GROUP BY subscription_status
ORDER BY user_count DESC;

-- Check users who appear to be subscribed
SELECT 
  clerk_user_id,
  email,
  credits,
  subscription_status,
  subscription_plan,
  razorpay_customer_id,
  created_at
FROM users
WHERE subscription_status = 'active'
ORDER BY created_at DESC;

-- Fix: Set all non-paying users to 'none'
UPDATE users
SET subscription_status = 'none'
WHERE subscription_status IS NULL 
   OR (subscription_status = 'active' AND razorpay_customer_id IS NULL);

-- Verify the fix
SELECT 
  subscription_status,
  COUNT(*) as user_count
FROM users
GROUP BY subscription_status;
