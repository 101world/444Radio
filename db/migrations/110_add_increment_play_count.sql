-- Migration 110: Add atomic play count increment function
-- This prevents race conditions when multiple users play the same track

CREATE OR REPLACE FUNCTION increment_play_count(media_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
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
