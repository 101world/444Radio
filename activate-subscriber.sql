-- Find user with Razorpay customer ID cust_RzpFbQMBALcaE3
-- Run this in Supabase SQL Editor

-- Step 1: Check if we have this customer ID
SELECT clerk_user_id, email, credits, subscription_status, razorpay_customer_id
FROM users
WHERE razorpay_customer_id = 'cust_RzpFbQMBALcaE3';

-- If not found, we need to find the user by their email/clerk_id from Razorpay dashboard
-- Then update with customer ID and activate subscription

-- Step 2: Manually activate (replace clerk_user_id with actual ID from above or from Razorpay dashboard)
UPDATE users
SET 
  credits = credits + 100,
  subscription_status = 'active',
  subscription_plan = 'creator',
  subscription_id = 'sub_S2ECfcFfPrjEm8',
  razorpay_customer_id = 'cust_RzpFbQMBALcaE3',
  subscription_start = NOW(),
  subscription_end = NOW() + INTERVAL '30 days'
WHERE clerk_user_id = 'USER_ID_HERE';  -- Replace with actual clerk_user_id

-- Step 3: Verify the update
SELECT clerk_user_id, email, credits, subscription_status, subscription_plan, razorpay_customer_id
FROM users
WHERE razorpay_customer_id = 'cust_RzpFbQMBALcaE3';
