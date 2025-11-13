-- =====================================================
-- 444 RADIO: LIKE SYSTEM MIGRATION
-- =====================================================
-- Copy this entire file and paste it into Supabase SQL Editor
-- Then click "Run" to deploy the like system
-- =====================================================

-- Step 1: Add likes_count column to combined_media table
ALTER TABLE combined_media
ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- Step 2: Create user_likes junction table
CREATE TABLE IF NOT EXISTS user_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- Clerk user ID
  release_id UUID NOT NULL REFERENCES combined_media(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure user can only like a release once
  UNIQUE(user_id, release_id)
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_likes_user ON user_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_likes_release ON user_likes(release_id);
CREATE INDEX IF NOT EXISTS idx_user_likes_created ON user_likes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_combined_media_likes ON combined_media(likes_count DESC);

-- Step 4: Enable Row Level Security (RLS)
ALTER TABLE user_likes ENABLE ROW LEVEL SECURITY;

-- Step 5: Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Anyone can view likes" ON user_likes;
DROP POLICY IF EXISTS "Users can create own likes" ON user_likes;
DROP POLICY IF EXISTS "Users can delete own likes" ON user_likes;

-- Step 6: Create RLS Policies for user_likes
-- Note: These policies work with Service Role Key (used by API)
-- which bypasses RLS, so they're mainly for direct client access

-- Anyone can view likes
CREATE POLICY "Anyone can view likes"
  ON user_likes FOR SELECT
  USING (true);

-- Anyone can insert (API will validate with Clerk auth)
CREATE POLICY "Users can create own likes"
  ON user_likes FOR INSERT
  WITH CHECK (true);

-- Anyone can delete (API will validate with Clerk auth)
CREATE POLICY "Users can delete own likes"
  ON user_likes FOR DELETE
  USING (true);

-- Step 7: Create function to automatically update likes_count
CREATE OR REPLACE FUNCTION update_combined_media_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment likes_count when someone likes
    UPDATE combined_media
    SET likes_count = likes_count + 1
    WHERE id = NEW.release_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement likes_count when someone unlikes (never go below 0)
    UPDATE combined_media
    SET likes_count = GREATEST(likes_count - 1, 0)
    WHERE id = OLD.release_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create trigger to run the function
DROP TRIGGER IF EXISTS trigger_update_likes_count ON user_likes;
CREATE TRIGGER trigger_update_likes_count
  AFTER INSERT OR DELETE ON user_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_combined_media_likes_count();

-- Step 9: Backfill existing likes_count (set all to 0 initially)
UPDATE combined_media
SET likes_count = COALESCE((
  SELECT COUNT(*)
  FROM user_likes
  WHERE user_likes.release_id = combined_media.id
), 0)
WHERE likes_count IS NULL;

-- Step 10: Add helpful comments
COMMENT ON TABLE user_likes IS 'Tracks which users liked which releases (many-to-many relationship)';
COMMENT ON COLUMN user_likes.user_id IS 'Clerk user ID of the person who liked';
COMMENT ON COLUMN user_likes.release_id IS 'ID of the combined_media release that was liked';
COMMENT ON COLUMN combined_media.likes_count IS 'Cached count of total likes for performance (auto-updated by trigger)';

-- =====================================================
-- MIGRATION COMPLETE! 
-- =====================================================
-- The like system is now ready to use.
-- 
-- Test it by:
-- 1. Refresh your app (hard refresh: Ctrl+Shift+R)
-- 2. Click a heart icon on any track
-- 3. Check /api/debug/likes to verify it worked
-- =====================================================

SELECT 'Like system migration completed successfully! 🎉' AS status;
