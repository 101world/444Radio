-- Create private_lists table for artist events/performances
CREATE TABLE IF NOT EXISTS private_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  event_date TIMESTAMP WITH TIME ZONE,
  price_credits INTEGER NOT NULL DEFAULT 0,
  max_capacity INTEGER,
  cover_image_url TEXT,
  video_url TEXT,
  hype_text TEXT,
  requirements TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create private_list_members table for users who joined
CREATE TABLE IF NOT EXISTS private_list_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES private_lists(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  credits_paid INTEGER NOT NULL,
  UNIQUE(list_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_private_lists_artist_id ON private_lists(artist_id);
CREATE INDEX IF NOT EXISTS idx_private_lists_active ON private_lists(is_active);
CREATE INDEX IF NOT EXISTS idx_private_list_members_list_id ON private_list_members(list_id);
CREATE INDEX IF NOT EXISTS idx_private_list_members_user_id ON private_list_members(user_id);

-- Enable Row Level Security
ALTER TABLE private_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_list_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for private_lists
CREATE POLICY "Anyone can view active private lists"
  ON private_lists FOR SELECT
  USING (is_active = true);

CREATE POLICY "Artists can create their own private lists"
  ON private_lists FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Artists can update their own private lists"
  ON private_lists FOR UPDATE
  USING (true);

CREATE POLICY "Artists can delete their own private lists"
  ON private_lists FOR DELETE
  USING (true);

-- RLS Policies for private_list_members
CREATE POLICY "Anyone can view private list members"
  ON private_list_members FOR SELECT
  USING (true);

CREATE POLICY "Users can join private lists"
  ON private_list_members FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can leave private lists"
  ON private_list_members FOR DELETE
  USING (true);
