-- COMPLETE DATABASE SETUP FOR STATION PAGE
-- Run this in Supabase SQL Editor

-- 1. Ensure live_stations table exists with all required columns
CREATE TABLE IF NOT EXISTS live_stations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  is_live BOOLEAN DEFAULT false,
  title TEXT,
  current_track_id TEXT,
  current_track_title TEXT,
  current_track_image TEXT,
  listener_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add missing title column (if table already exists)
ALTER TABLE live_stations ADD COLUMN IF NOT EXISTS title TEXT;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_live_stations_user_id ON live_stations(user_id);
CREATE INDEX IF NOT EXISTS idx_live_stations_is_live ON live_stations(is_live);
CREATE INDEX IF NOT EXISTS idx_live_stations_title ON live_stations(title);

-- 4. Create updated_at trigger (auto-update timestamp)
CREATE OR REPLACE FUNCTION update_live_stations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS live_stations_updated_at ON live_stations;
CREATE TRIGGER live_stations_updated_at
  BEFORE UPDATE ON live_stations
  FOR EACH ROW
  EXECUTE FUNCTION update_live_stations_updated_at();

-- 5. Verify table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'live_stations'
ORDER BY ordinal_position;

-- 6. Check if any live stations exist
SELECT COUNT(*) as total_stations, 
       COUNT(*) FILTER (WHERE is_live = true) as live_now
FROM live_stations;
