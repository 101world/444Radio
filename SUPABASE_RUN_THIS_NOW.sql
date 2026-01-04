-- =====================================================
-- 444Radio - Fix Followers & Users Tables
-- SAFE TO RUN - Uses IF NOT EXISTS checks
-- Copy this entire file and run in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. CREATE USERS TABLE (if it doesn't exist)
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  bio TEXT,
  location TEXT,
  website TEXT,
  social_links JSONB DEFAULT '{}'::jsonb,
  credits INTEGER DEFAULT 0,
  total_generated INTEGER DEFAULT 0,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to users table if they don't exist
DO $$ 
BEGIN
  -- Add full_name
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='full_name') THEN
    ALTER TABLE users ADD COLUMN full_name TEXT;
  END IF;

  -- Add banner_url
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='banner_url') THEN
    ALTER TABLE users ADD COLUMN banner_url TEXT;
  END IF;

  -- Add location
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='location') THEN
    ALTER TABLE users ADD COLUMN location TEXT;
  END IF;

  -- Add website
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='website') THEN
    ALTER TABLE users ADD COLUMN website TEXT;
  END IF;

  -- Add social_links
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='social_links') THEN
    ALTER TABLE users ADD COLUMN social_links JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- =====================================================
-- 2. CREATE FOLLOWERS TABLE (if it doesn't exist)
-- =====================================================

CREATE TABLE IF NOT EXISTS followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id TEXT NOT NULL,
  following_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- =====================================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. DROP OLD POLICIES (if they exist)
-- =====================================================

-- Users policies
DROP POLICY IF EXISTS "Users can view all profiles" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Service role can manage users" ON users;

-- Followers policies
DROP POLICY IF EXISTS "Followers are viewable by everyone" ON followers;
DROP POLICY IF EXISTS "Users can follow others" ON followers;
DROP POLICY IF EXISTS "Users can unfollow" ON followers;

-- =====================================================
-- 5. CREATE RLS POLICIES
-- =====================================================

-- Users table policies (very permissive for now)
CREATE POLICY "Users can view all profiles"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can manage users"
  ON users
  USING (true)
  WITH CHECK (true);

-- Followers table policies (very permissive for now)
CREATE POLICY "Followers are viewable by everyone"
  ON followers FOR SELECT
  USING (true);

CREATE POLICY "Users can follow others"
  ON followers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can unfollow"
  ON followers FOR DELETE
  USING (true);

-- =====================================================
-- 6. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Followers indexes
CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_following_id ON followers(following_id);
CREATE INDEX IF NOT EXISTS idx_followers_both ON followers(follower_id, following_id);

-- =====================================================
-- 7. VERIFY SETUP (Check what was created)
-- =====================================================

-- Show users table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- Show followers table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'followers' 
ORDER BY ordinal_position;

-- Count existing data
SELECT 'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'followers' as table_name, COUNT(*) as row_count FROM followers;

-- =====================================================
-- DONE! This should fix the 404 and 400 errors
-- =====================================================
