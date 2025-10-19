-- 444RADIO Database UPDATE Script
-- Run this to add new columns and tables to existing database

-- ========================================
-- 1. UPDATE users table with new columns
-- ========================================

-- Add credits column (default 20)
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 20;

-- Add bio column
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add avatar_url column
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add total_generated counter
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_generated INTEGER DEFAULT 0;

-- Add follower counts
ALTER TABLE users ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;

-- Update existing users to have 20 credits if they have NULL
UPDATE users SET credits = 20 WHERE credits IS NULL;

-- ========================================
-- 1.5. UPDATE songs table with missing columns
-- ========================================

-- Add status column if it doesn't exist
ALTER TABLE songs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'generating';

-- Add other missing columns to songs table
ALTER TABLE songs ADD COLUMN IF NOT EXISTS prompt TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS lyrics TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS bpm INTEGER;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS genre TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS instrumental BOOLEAN DEFAULT false;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS cover_prompt TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS duration INTEGER;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS plays INTEGER DEFAULT 0;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false; -- Songs are private by default!

-- ========================================
-- 2. CREATE new tables (follows & credits_history)
-- ========================================

-- Create follows table
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  following_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Create credits_history table
CREATE TABLE IF NOT EXISTS credits_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- 3. ENABLE Row Level Security on new tables
-- ========================================

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits_history ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 4. CREATE RLS Policies for new tables
-- ========================================

-- Follows policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Follows are viewable by everyone' AND tablename = 'follows') THEN
        CREATE POLICY "Follows are viewable by everyone" ON follows FOR SELECT USING (true);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can follow others' AND tablename = 'follows') THEN
        CREATE POLICY "Users can follow others" ON follows FOR INSERT WITH CHECK (follower_id = auth.jwt()->>'sub');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can unfollow' AND tablename = 'follows') THEN
        CREATE POLICY "Users can unfollow" ON follows FOR DELETE USING (follower_id = auth.jwt()->>'sub');
    END IF;
END $$;

-- Credits history policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own credit history' AND tablename = 'credits_history') THEN
        CREATE POLICY "Users can view own credit history" ON credits_history FOR SELECT USING (user_id = auth.jwt()->>'sub');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'System can insert credit records' AND tablename = 'credits_history') THEN
        CREATE POLICY "System can insert credit records" ON credits_history FOR INSERT WITH CHECK (true);
    END IF;
END $$;

-- ========================================
-- 5. CREATE new indexes
-- ========================================

CREATE INDEX IF NOT EXISTS idx_songs_status ON songs(status);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_credits_user ON credits_history(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_created ON credits_history(created_at DESC);

-- ========================================
-- 6. CREATE/UPDATE Functions
-- ========================================

-- Function to update follower counts
CREATE OR REPLACE FUNCTION update_follower_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE users SET follower_count = follower_count + 1 WHERE clerk_user_id = NEW.following_id;
    UPDATE users SET following_count = following_count + 1 WHERE clerk_user_id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE users SET follower_count = follower_count - 1 WHERE clerk_user_id = OLD.following_id;
    UPDATE users SET following_count = following_count - 1 WHERE clerk_user_id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

-- Function to deduct credits on music generation
CREATE OR REPLACE FUNCTION deduct_generation_credit()
RETURNS TRIGGER AS $$
BEGIN
  -- Deduct 1 credit from user
  UPDATE users SET credits = credits - 1, total_generated = total_generated + 1
  WHERE clerk_user_id = NEW.user_id;
  
  -- Log the credit usage
  INSERT INTO credits_history (user_id, amount, reason, song_id)
  VALUES (NEW.user_id, -1, 'generation', NEW.id);
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to add signup bonus credits
CREATE OR REPLACE FUNCTION add_signup_credits()
RETURNS TRIGGER AS $$
BEGIN
  -- Log the signup bonus
  INSERT INTO credits_history (user_id, amount, reason)
  VALUES (NEW.clerk_user_id, 20, 'signup');
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ========================================
-- 7. CREATE Triggers (drop if exists first)
-- ========================================

-- Follower counts trigger
DROP TRIGGER IF EXISTS update_follower_counts_trigger ON follows;
CREATE TRIGGER update_follower_counts_trigger
    AFTER INSERT OR DELETE ON follows
    FOR EACH ROW EXECUTE FUNCTION update_follower_counts();

-- Credit deduction trigger
DROP TRIGGER IF EXISTS deduct_credit_on_generation ON songs;
CREATE TRIGGER deduct_credit_on_generation
    AFTER INSERT ON songs
    FOR EACH ROW EXECUTE FUNCTION deduct_generation_credit();

-- Signup bonus trigger
DROP TRIGGER IF EXISTS add_signup_bonus ON users;
CREATE TRIGGER add_signup_bonus
    AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION add_signup_credits();

-- ========================================
-- 8. Give existing users signup bonuses retroactively
-- ========================================

-- Add signup bonus to credit history for existing users
INSERT INTO credits_history (user_id, amount, reason)
SELECT clerk_user_id, 20, 'signup'
FROM users
WHERE clerk_user_id NOT IN (SELECT user_id FROM credits_history WHERE reason = 'signup')
ON CONFLICT DO NOTHING;

-- ========================================
-- ✅ UPDATE COMPLETE!
-- ========================================

-- Verify the changes
SELECT 
  'users' as table_name, 
  COUNT(*) as total_records,
  AVG(credits) as avg_credits,
  SUM(total_generated) as total_songs_generated
FROM users
UNION ALL
SELECT 
  'songs' as table_name, 
  COUNT(*) as total_records,
  NULL as avg_credits,
  NULL as total_songs_generated
FROM songs
UNION ALL
SELECT 
  'follows' as table_name, 
  COUNT(*) as total_records,
  NULL as avg_credits,
  NULL as total_songs_generated
FROM follows
UNION ALL
SELECT 
  'credits_history' as table_name, 
  COUNT(*) as total_records,
  NULL as avg_credits,
  NULL as total_songs_generated
FROM credits_history;
