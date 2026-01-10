-- Run this to see what YOUR account shows
SELECT 
  clerk_user_id,
  email,
  credits,
  subscription_status,
  razorpay_customer_id,
  subscription_plan,
  subscription_id
FROM users
WHERE clerk_user_id = (
  SELECT clerk_user_id FROM users 
  ORDER BY updated_at DESC 
  LIMIT 1
);

-- Or search by your email
SELECT 
  clerk_user_id,
  email,
  credits,
  subscription_status,
  razorpay_customer_id
FROM users
WHERE email ILIKE '%your-email%';  -- Replace with your actual email
