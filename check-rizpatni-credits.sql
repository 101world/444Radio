-- Check rizpatni's current status
SELECT 
  clerk_user_id,
  email,
  credits,
  subscription_status,
  razorpay_customer_id,
  subscription_id,
  subscription_plan
FROM users
WHERE email = 'rizzpatnii@gmail.com' 
   OR razorpay_customer_id = 'cust_RzpFbQMBALcaE3';
