-- Add metadata columns to combined_media table
-- This migration adds comprehensive metadata fields for better search and discovery

ALTER TABLE combined_media
ADD COLUMN IF NOT EXISTS genre VARCHAR(100),
ADD COLUMN IF NOT EXISTS mood VARCHAR(100),
ADD COLUMN IF NOT EXISTS tags TEXT[], -- Array of tags
ADD COLUMN IF NOT EXISTS bpm INTEGER,
ADD COLUMN IF NOT EXISTS key VARCHAR(10), -- Musical key (C, D#, etc.)
ADD COLUMN IF NOT EXISTS instruments TEXT[], -- Array of instruments
ADD COLUMN IF NOT EXISTS vocals VARCHAR(50), -- male, female, both, none
ADD COLUMN IF NOT EXISTS language VARCHAR(50), -- english, spanish, etc.
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS duration INTEGER, -- in seconds
ADD COLUMN IF NOT EXISTS explicit BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS release_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_combined_media_genre ON combined_media(genre);
CREATE INDEX IF NOT EXISTS idx_combined_media_mood ON combined_media(mood);
CREATE INDEX IF NOT EXISTS idx_combined_media_tags ON combined_media USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_combined_media_bpm ON combined_media(bpm);
CREATE INDEX IF NOT EXISTS idx_combined_media_vocals ON combined_media(vocals);
CREATE INDEX IF NOT EXISTS idx_combined_media_language ON combined_media(language);

-- Update existing records with default values
UPDATE combined_media 
SET 
  genre = 'Electronic',
  mood = 'Energetic',
  tags = ARRAY['AI Generated', 'Experimental'],
  vocals = 'none',
  language = 'instrumental'
WHERE genre IS NULL;

COMMENT ON COLUMN combined_media.genre IS 'Musical genre (Pop, Rock, Hip-Hop, Electronic, etc.)';
COMMENT ON COLUMN combined_media.mood IS 'Emotional mood of the track (Happy, Sad, Energetic, Chill, etc.)';
COMMENT ON COLUMN combined_media.tags IS 'Array of searchable tags';
COMMENT ON COLUMN combined_media.bpm IS 'Beats per minute (tempo)';
COMMENT ON COLUMN combined_media.key IS 'Musical key of the track';
COMMENT ON COLUMN combined_media.instruments IS 'Array of instruments featured';
COMMENT ON COLUMN combined_media.vocals IS 'Type of vocals (male, female, both, none/instrumental)';
COMMENT ON COLUMN combined_media.language IS 'Language of lyrics or instrumental';
COMMENT ON COLUMN combined_media.description IS 'User-provided description of the track';
COMMENT ON COLUMN combined_media.explicit IS 'Whether track contains explicit content';
