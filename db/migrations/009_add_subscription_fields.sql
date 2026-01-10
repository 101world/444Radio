-- Add subscription fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS subscription_plan TEXT,
ADD COLUMN IF NOT EXISTS subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_start BIGINT,
ADD COLUMN IF NOT EXISTS subscription_end BIGINT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_razorpay_customer ON users(razorpay_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_id ON users(subscription_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);

-- Add comment
COMMENT ON COLUMN users.razorpay_customer_id IS 'Razorpay customer ID for subscription management';
COMMENT ON COLUMN users.subscription_status IS 'active, cancelled, expired, or none';
COMMENT ON COLUMN users.subscription_plan IS 'Razorpay plan ID';
