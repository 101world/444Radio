-- BULK FIX: Sync ALL Razorpay subscribers to database
-- This handles existing subscribers who paid but didn't get credits

-- STEP 1: Find all active subscriptions in Razorpay
-- Go to Razorpay Dashboard → Subscriptions → Export to CSV
-- You'll get columns: subscription_id, customer_id, customer_email, plan_id, status

-- STEP 2: For each active subscriber, run this:
-- (Replace the email, customer_id, and subscription_id for each one)

INSERT INTO users (
  clerk_user_id,
  email,
  credits,
  subscription_status,
  subscription_plan,
  subscription_id,
  razorpay_customer_id,
  subscription_start,
  subscription_end,
  created_at,
  updated_at
)
VALUES (
  'temp_' || 'CUSTOMER_ID_HERE',  -- Temporary clerk_user_id until they sign up
  'CUSTOMER_EMAIL_HERE',
  100,  -- Give them 100 credits
  'active',
  'plan_S2DGVK6J270rtt',
  'SUBSCRIPTION_ID_HERE',
  'CUSTOMER_ID_HERE',
  EXTRACT(EPOCH FROM NOW())::BIGINT,
  EXTRACT(EPOCH FROM (NOW() + INTERVAL '30 days'))::BIGINT,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  credits = users.credits + 100,
  subscription_status = 'active',
  subscription_plan = 'plan_S2DGVK6J270rtt',
  subscription_id = EXCLUDED.subscription_id,
  razorpay_customer_id = EXCLUDED.razorpay_customer_id,
  subscription_start = EXCLUDED.subscription_start,
  subscription_end = EXCLUDED.subscription_end,
  updated_at = NOW();

-- STEP 3: When they actually sign up on 444Radio:
-- The Clerk webhook will update their clerk_user_id automatically
