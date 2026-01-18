-- Add type and media_url columns to combined_media table for video/audio storage
-- type: distinguishes between 'music', 'image', 'video', 'remix', etc.
-- media_url: generic URL field for any type of media

-- Add type column to distinguish content types
ALTER TABLE combined_media 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'music';

-- Add media_url column for generic media storage
ALTER TABLE combined_media 
ADD COLUMN IF NOT EXISTS media_url TEXT;

-- Add prompt column for single prompt storage
ALTER TABLE combined_media 
ADD COLUMN IF NOT EXISTS prompt TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_combined_media_type 
ON combined_media(type);

CREATE INDEX IF NOT EXISTS idx_combined_media_media_url 
ON combined_media(media_url) 
WHERE media_url IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN combined_media.type IS 'Content type: music, image, video, remix, etc.';
COMMENT ON COLUMN combined_media.media_url IS 'Generic media URL for videos, remixes, or other content types';
COMMENT ON COLUMN combined_media.prompt IS 'Single prompt field (for content with unified prompts)';
