-- Give rizpatni his 100 credits + activate subscription
UPDATE users
SET 
  credits = credits + 100,
  subscription_status = 'active',
  subscription_plan = 'plan_S2DGVK6J270rtt',
  razorpay_customer_id = 'cust_RzpFbQMBALcaE3',
  subscription_id = 'sub_S2ECfcFfPrjEm8',
  subscription_start = EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  subscription_end = (EXTRACT(EPOCH FROM NOW())::BIGINT + 2592000) * 1000
WHERE email = 'rizzpatnii@gmail.com';

-- Verify
SELECT email, credits, subscription_status FROM users WHERE email = 'rizzpatnii@gmail.com';
