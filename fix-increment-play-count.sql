-- Ensure increment_play_count function exists with correct permissions
-- Drop if exists to recreate cleanly
DROP FUNCTION IF EXISTS increment_play_count(uuid);

-- Create the function
CREATE OR REPLACE FUNCTION increment_play_count(media_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER -- Run with owner privileges to bypass RLS
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

-- Grant execute permission to everyone (anon and authenticated)
GRANT EXECUTE ON FUNCTION increment_play_count(uuid) TO anon;
GRANT EXECUTE ON FUNCTION increment_play_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_play_count(uuid) TO service_role;

-- Also ensure plays column has default value of 0
ALTER TABLE combined_media 
ALTER COLUMN plays SET DEFAULT 0;

-- Update any NULL plays to 0
UPDATE combined_media 
SET plays = 0 
WHERE plays IS NULL;
