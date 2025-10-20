-- Create users table to store Clerk user data
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  username TEXT,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow all users to read user data (for profile pages, etc.)
CREATE POLICY "Users are viewable by everyone" ON users
  FOR SELECT USING (true);

-- Users can update their own data
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid()::text = clerk_user_id);

-- Allow inserts from service role (for webhooks)
CREATE POLICY "Service role can insert users" ON users
  FOR INSERT WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE users IS 'Stores user profile data synced from Clerk';
COMMENT ON COLUMN users.clerk_user_id IS 'Clerk user ID (user_xxx format)';
COMMENT ON COLUMN users.username IS 'Display username for the user';
