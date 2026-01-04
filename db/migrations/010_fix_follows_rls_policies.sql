-- Fix RLS policies for follows table to allow follow/unfollow operations

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view all follows" ON follows;
DROP POLICY IF EXISTS "Users can follow others" ON follows;
DROP POLICY IF EXISTS "Users can unfollow" ON follows;

-- Enable RLS
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Policy 1: Anyone can view all follows (needed for follower counts and lists)
CREATE POLICY "Users can view all follows"
ON follows FOR SELECT
TO authenticated
USING (true);

-- Policy 2: Users can insert their own follows (follow someone)
CREATE POLICY "Users can follow others"
ON follows FOR INSERT
TO authenticated
WITH CHECK (follower_id = auth.uid());

-- Policy 3: Users can delete their own follows (unfollow)
CREATE POLICY "Users can unfollow"
ON follows FOR DELETE
TO authenticated
USING (follower_id = auth.uid());
