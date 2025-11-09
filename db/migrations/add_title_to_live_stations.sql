-- Add title column to live_stations table for custom station names
ALTER TABLE live_stations ADD COLUMN IF NOT EXISTS title TEXT;

-- Create index for title searches
CREATE INDEX IF NOT EXISTS idx_live_stations_title ON live_stations(title);
