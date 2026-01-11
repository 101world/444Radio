-- URGENT FIX: Add missing title column to live_stations table
-- Run this IMMEDIATELY in Supabase SQL Editor

-- Add title column if it doesn't exist
ALTER TABLE live_stations ADD COLUMN IF NOT EXISTS title TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_live_stations_title ON live_stations(title);

-- Verify the column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'live_stations';
