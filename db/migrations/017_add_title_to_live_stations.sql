-- Add missing title column to live_stations table
ALTER TABLE live_stations ADD COLUMN IF NOT EXISTS title TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_live_stations_title ON live_stations(title);
