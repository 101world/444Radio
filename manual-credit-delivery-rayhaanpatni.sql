-- Manual credit delivery for rayhaanpatni@gmail.com
-- Payment: pay_S2JnkDsIHRAXJh (₹450 paid successfully)

-- First, check current credits
SELECT clerk_user_id, email, credits, subscription_status 
FROM users 
WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R';

-- Deliver 100 credits + activate subscription
UPDATE users
SET 
  credits = credits + 100,
  subscription_status = 'active',
  subscription_plan = 'plan_S2DGVK6J270rtt',
  subscription_id = 'sub_S2JlrtJA67zmBM',
  razorpay_customer_id = 'cust_S2GjrLyAasH9Jg',
  updated_at = NOW()
WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R';

-- Verify
SELECT clerk_user_id, email, credits, subscription_status, subscription_id
FROM users 
WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R';
