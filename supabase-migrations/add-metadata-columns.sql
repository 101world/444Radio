-- Add metadata columns to combined_media_library table
-- Run this in Supabase SQL Editor

ALTER TABLE combined_media_library
ADD COLUMN IF NOT EXISTS genre TEXT,
ADD COLUMN IF NOT EXISTS mood TEXT,
ADD COLUMN IF NOT EXISTS bpm INTEGER,
ADD COLUMN IF NOT EXISTS key TEXT,
ADD COLUMN IF NOT EXISTS copyright_owner TEXT,
ADD COLUMN IF NOT EXISTS license_type TEXT DEFAULT 'All Rights Reserved',
ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_combined_media_library_genre ON combined_media_library(genre);
CREATE INDEX IF NOT EXISTS idx_combined_media_library_mood ON combined_media_library(mood);
CREATE INDEX IF NOT EXISTS idx_combined_media_library_tags ON combined_media_library USING GIN(tags);

-- Also add these columns to combined_media table for public display
ALTER TABLE combined_media
ADD COLUMN IF NOT EXISTS username TEXT,
ADD COLUMN IF NOT EXISTS genre TEXT,
ADD COLUMN IF NOT EXISTS mood TEXT,
ADD COLUMN IF NOT EXISTS bpm INTEGER,
ADD COLUMN IF NOT EXISTS key TEXT,
ADD COLUMN IF NOT EXISTS copyright_owner TEXT,
ADD COLUMN IF NOT EXISTS license_type TEXT DEFAULT 'All Rights Reserved',
ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Add indexes for filtering on explore page
CREATE INDEX IF NOT EXISTS idx_combined_media_genre ON combined_media(genre);
CREATE INDEX IF NOT EXISTS idx_combined_media_mood ON combined_media(mood);
CREATE INDEX IF NOT EXISTS idx_combined_media_tags ON combined_media USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_combined_media_price ON combined_media(price);

-- Add comment for documentation
COMMENT ON COLUMN combined_media_library.copyright_owner IS 'Name of the copyright holder';
COMMENT ON COLUMN combined_media_library.license_type IS 'Type of license: All Rights Reserved, Creative Commons, etc.';
COMMENT ON COLUMN combined_media_library.price IS 'Price for commercial licensing (null = not for sale)';
COMMENT ON COLUMN combined_media_library.tags IS 'Array of searchable tags for filtering';
