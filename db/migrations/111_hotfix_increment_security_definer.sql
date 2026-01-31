-- HOTFIX: Add SECURITY DEFINER to increment_play_count function
-- This allows the function to bypass RLS policies and update plays column
-- Without this, users cannot increment play counts due to RLS restrictions

CREATE OR REPLACE FUNCTION increment_play_count(media_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER  -- CRITICAL: This bypasses RLS and allows the function to update
SET search_path = public
AS $$
DECLARE
  new_play_count INTEGER;
BEGIN
  -- Atomically increment and return new play count
  UPDATE combined_media
  SET plays = COALESCE(plays, 0) + 1
  WHERE id = media_id
  RETURNING plays INTO new_play_count;
  
  RETURN new_play_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_play_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_play_count(uuid) TO anon;
