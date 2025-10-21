-- Create live_stations table to track active broadcasts
CREATE TABLE IF NOT EXISTS live_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  is_live BOOLEAN DEFAULT false,
  current_track_id TEXT,
  current_track_title TEXT,
  current_track_image TEXT,
  listener_count INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create station_messages table for chat history
CREATE TABLE IF NOT EXISTS station_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID REFERENCES live_stations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT CHECK (message_type IN ('chat', 'track')) DEFAULT 'chat',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create station_listeners table to track who's listening
CREATE TABLE IF NOT EXISTS station_listeners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID REFERENCES live_stations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  username TEXT,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(station_id, user_id)
);

-- Enable realtime for these tables
ALTER TABLE live_stations REPLICA IDENTITY FULL;
ALTER TABLE station_messages REPLICA IDENTITY FULL;
ALTER TABLE station_listeners REPLICA IDENTITY FULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_live_stations_user_id ON live_stations(user_id);
CREATE INDEX IF NOT EXISTS idx_live_stations_is_live ON live_stations(is_live);
CREATE INDEX IF NOT EXISTS idx_station_messages_station_id ON station_messages(station_id);
CREATE INDEX IF NOT EXISTS idx_station_messages_created_at ON station_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_station_listeners_station_id ON station_listeners(station_id);

-- Function to update listener count
CREATE OR REPLACE FUNCTION update_listener_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE live_stations
  SET listener_count = (
    SELECT COUNT(*) FROM station_listeners 
    WHERE station_id = COALESCE(NEW.station_id, OLD.station_id)
  )
  WHERE id = COALESCE(NEW.station_id, OLD.station_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update listener count
DROP TRIGGER IF EXISTS update_listener_count_trigger ON station_listeners;
CREATE TRIGGER update_listener_count_trigger
AFTER INSERT OR DELETE ON station_listeners
FOR EACH ROW EXECUTE FUNCTION update_listener_count();

-- Function to cleanup old messages (optional - keep last 100 per station)
CREATE OR REPLACE FUNCTION cleanup_old_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM station_messages
  WHERE id IN (
    SELECT id FROM station_messages
    WHERE station_id IN (SELECT id FROM live_stations)
    ORDER BY created_at DESC
    OFFSET 100
  );
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE live_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_listeners ENABLE ROW LEVEL SECURITY;

-- Everyone can view live stations
CREATE POLICY "Anyone can view live stations"
  ON live_stations FOR SELECT
  USING (true);

-- Users can update their own station
CREATE POLICY "Users can update own station"
  ON live_stations FOR UPDATE
  USING (user_id = auth.jwt() ->> 'sub');

-- Users can insert their own station
CREATE POLICY "Users can insert own station"
  ON live_stations FOR INSERT
  WITH CHECK (user_id = auth.jwt() ->> 'sub');

-- Everyone can view messages
CREATE POLICY "Anyone can view messages"
  ON station_messages FOR SELECT
  USING (true);

-- Authenticated users can send messages
CREATE POLICY "Authenticated users can send messages"
  ON station_messages FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Everyone can view listeners
CREATE POLICY "Anyone can view listeners"
  ON station_listeners FOR SELECT
  USING (true);

-- Authenticated users can join stations
CREATE POLICY "Authenticated users can join stations"
  ON station_listeners FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Users can remove themselves as listeners
CREATE POLICY "Users can remove themselves"
  ON station_listeners FOR DELETE
  USING (user_id = auth.jwt() ->> 'sub');
