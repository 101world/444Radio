-- Add media_url column to combined_media table for video/audio storage
-- This is a generic URL field that can store any type of media

ALTER TABLE combined_media 
ADD COLUMN IF NOT EXISTS media_url TEXT;

-- Add index for media_url queries
CREATE INDEX IF NOT EXISTS idx_combined_media_media_url 
ON combined_media(media_url) 
WHERE media_url IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN combined_media.media_url IS 'Generic media URL for videos, remixes, or other content types';
