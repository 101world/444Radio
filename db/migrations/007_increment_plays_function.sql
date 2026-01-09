-- Create function to safely increment play count
CREATE OR REPLACE FUNCTION increment_plays(media_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE combined_media
  SET plays = plays + 1
  WHERE id = media_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_plays(uuid) TO authenticated;