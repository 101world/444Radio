-- Fix follower count trigger to use correct column names
-- Date: 2026-02-06
-- Issue: Trigger was using 'followed_id' but table has 'following_id'
--        AND was using 'followers_count' but column is 'follower_count' (no 's')

-- Drop and recreate the function with correct column names
CREATE OR REPLACE FUNCTION public.update_follower_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment follower count for the user being followed (note: follower_count not followers_count)
    UPDATE public.users 
    SET follower_count = COALESCE(follower_count, 0) + 1 
    WHERE clerk_user_id = NEW.following_id;
    
    -- Increment following count for the user who is following
    UPDATE public.users 
    SET following_count = COALESCE(following_count, 0) + 1 
    WHERE clerk_user_id = NEW.follower_id;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement follower count for the user being unfollowed
    UPDATE public.users 
    SET follower_count = GREATEST(0, COALESCE(follower_count, 0) - 1) 
    WHERE clerk_user_id = OLD.following_id;
    
    -- Decrement following count for the user who is unfollowing
    UPDATE public.users 
    SET following_count = GREATEST(0, COALESCE(following_count, 0) - 1) 
    WHERE clerk_user_id = OLD.follower_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_follower_counts_trigger ON followers;

-- Create trigger on followers table
CREATE TRIGGER update_follower_counts_trigger
  AFTER INSERT OR DELETE ON followers
  FOR EACH ROW
  EXECUTE FUNCTION update_follower_counts();

-- Verify trigger exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_follower_counts_trigger' 
    AND tgrelid = 'followers'::regclass
  ) THEN
    RAISE NOTICE '✅ Trigger update_follower_counts_trigger created on followers table';
    RAISE NOTICE '   → Updates follower_count and following_count columns';
  ELSE
    RAISE NOTICE '❌ Trigger creation failed';
  END IF;
END $$;
