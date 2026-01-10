-- Manual subscription activation for customer: cust_RzpFbQMBALcaE3
-- Run this to add 100 credits and activate subscription

-- Find the user by email or clerk_user_id and update
UPDATE users 
SET 
  credits = credits + 100,
  razorpay_customer_id = 'cust_RzpFbQMBALcaE3',
  subscription_status = 'active',
  subscription_plan = 'plan_S2DGVK6J270rtt',
  subscription_id = 'sub_S2ECfcFfPrjEm8',
  subscription_start = EXTRACT(EPOCH FROM NOW())::BIGINT,
  subscription_end = EXTRACT(EPOCH FROM NOW() + INTERVAL '30 days')::BIGINT,
  updated_at = NOW()
WHERE clerk_user_id = 'USER_CLERK_ID_HERE'; -- Replace with actual Clerk user ID

-- To find the user, first run:
-- SELECT clerk_user_id, email, credits, subscription_status FROM users WHERE email = 'user_email@example.com';
