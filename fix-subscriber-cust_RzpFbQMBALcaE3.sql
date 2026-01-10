-- FIX CURRENT SUBSCRIBER: cust_RzpFbQMBALcaE3
-- Follow these steps:

-- STEP 1: Find the user's email
-- Go to Razorpay Dashboard → Customers → Search for "cust_RzpFbQMBALcaE3"
-- Copy the email address shown

-- STEP 2: Find user in your database and check current state
-- Replace 'user@email.com' with the email from Step 1
SELECT 
  clerk_user_id,
  email,
  credits as current_credits,
  subscription_status,
  razorpay_customer_id
FROM users 
WHERE email = 'user@email.com';  -- ← REPLACE THIS

-- STEP 3: Add credits and activate subscription
-- Replace 'user@email.com' with the actual email
UPDATE users
SET 
  credits = credits + 100,
  subscription_status = 'active',
  subscription_plan = 'plan_S2DGVK6J270rtt',
  subscription_id = 'sub_S2ECfcFfPrjEm8',
  razorpay_customer_id = 'cust_RzpFbQMBALcaE3',
  subscription_start = EXTRACT(EPOCH FROM NOW())::BIGINT,
  subscription_end = EXTRACT(EPOCH FROM (NOW() + INTERVAL '30 days'))::BIGINT,
  updated_at = NOW()
WHERE email = 'user@email.com';  -- ← REPLACE THIS

-- STEP 4: Verify it worked
-- Replace 'user@email.com' with the actual email
SELECT 
  email,
  credits,
  subscription_status,
  subscription_plan,
  razorpay_customer_id
FROM users 
WHERE email = 'user@email.com';  -- ← REPLACE THIS

-- Should show:
-- credits: (old credits + 100)
-- subscription_status: active
-- subscription_plan: plan_S2DGVK6J270rtt
-- razorpay_customer_id: cust_RzpFbQMBALcaE3

-- STEP 5: Tell the user to refresh 444radio.co.in
-- They should see:
-- ✓ Gold crown icon
-- ✓ Purple gradient background
-- ✓ "CREATOR" label
-- ✓ 100 credits added
