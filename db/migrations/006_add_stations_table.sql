-- Add stations table for live broadcasting
CREATE TABLE IF NOT EXISTS stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  genre TEXT DEFAULT 'General',
  is_live BOOLEAN DEFAULT FALSE,
  listener_count INTEGER DEFAULT 0,
  last_live_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stations_user_id ON stations(user_id);
CREATE INDEX IF NOT EXISTS idx_stations_is_live ON stations(is_live);
CREATE INDEX IF NOT EXISTS idx_stations_listener_count ON stations(listener_count DESC);
CREATE INDEX IF NOT EXISTS idx_stations_last_live_at ON stations(last_live_at DESC NULLS LAST);

-- Enable RLS
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view stations"
  ON stations FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own stations"
  ON stations FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own stations"
  ON stations FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own stations"
  ON stations FOR DELETE
  USING (auth.uid()::text = user_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_stations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_stations_updated_at
  BEFORE UPDATE ON stations
  FOR EACH ROW
  EXECUTE FUNCTION update_stations_updated_at();
