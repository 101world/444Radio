-- Migration: Rename 'follows' table to 'followers' for consistency
-- Date: 2026-02-06
-- Reason: Code expects 'followers' but production has 'follows'

-- Check if follows table exists and followers doesn't
DO $$
BEGIN
  -- If follows exists and followers doesn't, rename it
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'follows')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'followers')
  THEN
    -- Rename the table
    ALTER TABLE follows RENAME TO followers;
    
    -- Update index names
    ALTER INDEX IF EXISTS idx_follows_follower_id RENAME TO idx_followers_follower_id;
    ALTER INDEX IF EXISTS idx_follows_following_id RENAME TO idx_followers_following_id;
    ALTER INDEX IF EXISTS idx_follows_both RENAME TO idx_followers_both;
    
    -- Drop old policies (they reference the old table name)
    DROP POLICY IF EXISTS "Users can view all follows" ON followers;
    DROP POLICY IF EXISTS "Users can follow others" ON followers;
    DROP POLICY IF EXISTS "Users can unfollow" ON followers;
    
    -- Recreate policies with correct names
    CREATE POLICY "Followers are viewable by everyone"
      ON followers FOR SELECT
      USING (true);

    CREATE POLICY "Users can follow others"
      ON followers FOR INSERT
      WITH CHECK (true);

    CREATE POLICY "Users can unfollow"
      ON followers FOR DELETE
      USING (true);
    
    RAISE NOTICE '✅ Successfully renamed follows → followers';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'followers') THEN
    RAISE NOTICE '✅ Table followers already exists, no action needed';
  ELSE
    RAISE NOTICE '⚠️ Neither follows nor followers table found - run 003_create_followers_table.sql first';
  END IF;
END $$;
