-- =====================================================
-- 444 RADIO: LIKE SYSTEM MIGRATION (SIMPLIFIED)
-- =====================================================
-- Run this in Supabase SQL Editor
-- =====================================================

-- Step 1: Add likes_count column to combined_media
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- Step 2: Create user_likes table
CREATE TABLE IF NOT EXISTS user_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  release_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, release_id)
);

-- Step 3: Add foreign key constraint
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_likes_release_id_fkey'
  ) THEN
    ALTER TABLE user_likes ADD CONSTRAINT user_likes_release_id_fkey 
    FOREIGN KEY (release_id) REFERENCES combined_media(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_user_likes_user ON user_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_likes_release ON user_likes(release_id);
CREATE INDEX IF NOT EXISTS idx_user_likes_created ON user_likes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_combined_media_likes ON combined_media(likes_count DESC);

-- Step 5: Enable RLS
ALTER TABLE user_likes ENABLE ROW LEVEL SECURITY;

-- Step 6: Drop old policies (safe if they don't exist)
DROP POLICY IF EXISTS "Anyone can view likes" ON user_likes;
DROP POLICY IF EXISTS "Users can create own likes" ON user_likes;
DROP POLICY IF EXISTS "Users can delete own likes" ON user_likes;

-- Step 7: Create simple RLS policies (API uses Service Role Key which bypasses these)
CREATE POLICY "Anyone can view likes" ON user_likes FOR SELECT USING (true);
CREATE POLICY "Users can create own likes" ON user_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete own likes" ON user_likes FOR DELETE USING (true);

-- Step 8: Create trigger function
CREATE OR REPLACE FUNCTION update_combined_media_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE combined_media SET likes_count = likes_count + 1 WHERE id = NEW.release_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE combined_media SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.release_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Create trigger
DROP TRIGGER IF EXISTS trigger_update_likes_count ON user_likes;
CREATE TRIGGER trigger_update_likes_count
  AFTER INSERT OR DELETE ON user_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_combined_media_likes_count();

-- Step 10: Initialize likes_count to 0 for all existing records
UPDATE combined_media SET likes_count = 0 WHERE likes_count IS NULL;

-- =====================================================
-- VERIFY IT WORKED
-- =====================================================
-- Run these queries to verify:

-- Check if user_likes table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'user_likes'
) AS user_likes_exists;

-- Check if likes_count column exists
SELECT EXISTS (
  SELECT FROM information_schema.columns 
  WHERE table_schema = 'public' 
  AND table_name = 'combined_media' 
  AND column_name = 'likes_count'
) AS likes_count_exists;

-- If both return 'true', migration succeeded! 🎉
