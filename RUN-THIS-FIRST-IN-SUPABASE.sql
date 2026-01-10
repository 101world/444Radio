-- CRITICAL: Run this FIRST in Supabase SQL Editor before deploying
-- This fixes the credits disappearing issue by adding subscription columns

-- Add subscription columns with IF NOT EXISTS (safe to run multiple times)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS subscription_plan TEXT,
ADD COLUMN IF NOT EXISTS subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_start BIGINT,
ADD COLUMN IF NOT EXISTS subscription_end BIGINT;

-- Set default for existing users
UPDATE users 
SET subscription_status = 'none' 
WHERE subscription_status IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_razorpay_customer ON users(razorpay_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_id ON users(subscription_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);

-- Verify columns exist
SELECT column_name, data_type, column_default
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

-- Should return 6 rows
