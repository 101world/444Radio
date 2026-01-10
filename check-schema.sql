-- Run this in Supabase SQL Editor to check if columns exist

-- Check if subscription columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN (
  'razorpay_customer_id',
  'subscription_status',
  'subscription_plan',
  'subscription_id',
  'subscription_start',
  'subscription_end'
)
ORDER BY column_name;

-- Check user data
SELECT 
  clerk_user_id,
  email,
  credits,
  COALESCE(subscription_status, 'COLUMN_MISSING') as sub_status
FROM users 
LIMIT 5;
