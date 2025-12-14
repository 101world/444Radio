-- Add is_live column to users table for Go Live functionality
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT false;

-- Create index for better performance when querying live users
CREATE INDEX IF NOT EXISTS idx_users_is_live ON users(is_live) WHERE is_live = true;

-- Add helpful comment
COMMENT ON COLUMN users.is_live IS 'Whether user is currently broadcasting live on their station';
