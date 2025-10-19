-- 444RADIO Supabase Database Schema
-- Run this in Supabase SQL Editor

-- Create users table to sync with Clerk
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  username TEXT,
  avatar_url TEXT,
  bio TEXT,
  credits INTEGER DEFAULT 20, -- Every user gets 20 credits on signup
  total_generated INTEGER DEFAULT 0,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create songs/music generations table
CREATE TABLE IF NOT EXISTS songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  prompt TEXT,
  lyrics TEXT,
  bpm INTEGER,
  genre TEXT,
  instrumental BOOLEAN DEFAULT false,
  audio_url TEXT,
  cover_url TEXT,
  cover_prompt TEXT,
  duration INTEGER,
  status TEXT DEFAULT 'generating', -- 'generating', 'completed', 'failed'
  plays INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create likes table
CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, song_id)
);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create playlists table
CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create playlist_songs junction table
CREATE TABLE IF NOT EXISTS playlist_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  position INTEGER,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(playlist_id, song_id)
);

-- Create follows table for social connections
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  following_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Create credits_history table to track credit usage
CREATE TABLE IF NOT EXISTS credits_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Positive for earned, negative for spent
  reason TEXT NOT NULL, -- 'signup', 'generation', 'purchase', 'bonus'
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view all profiles"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (clerk_user_id = auth.jwt()->>'sub');

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  WITH CHECK (clerk_user_id = auth.jwt()->>'sub');

-- RLS Policies for songs table
CREATE POLICY "Songs are viewable by everyone"
  ON songs FOR SELECT
  USING (true);

CREATE POLICY "Users can create own songs"
  ON songs FOR INSERT
  WITH CHECK (user_id = auth.jwt()->>'sub');

CREATE POLICY "Users can update own songs"
  ON songs FOR UPDATE
  USING (user_id = auth.jwt()->>'sub');

CREATE POLICY "Users can delete own songs"
  ON songs FOR DELETE
  USING (user_id = auth.jwt()->>'sub');

-- RLS Policies for likes table
CREATE POLICY "Likes are viewable by everyone"
  ON likes FOR SELECT
  USING (true);

CREATE POLICY "Users can create own likes"
  ON likes FOR INSERT
  WITH CHECK (user_id = auth.jwt()->>'sub');

CREATE POLICY "Users can delete own likes"
  ON likes FOR DELETE
  USING (user_id = auth.jwt()->>'sub');

-- RLS Policies for comments table
CREATE POLICY "Comments are viewable by everyone"
  ON comments FOR SELECT
  USING (true);

CREATE POLICY "Users can create own comments"
  ON comments FOR INSERT
  WITH CHECK (user_id = auth.jwt()->>'sub');

CREATE POLICY "Users can update own comments"
  ON comments FOR UPDATE
  USING (user_id = auth.jwt()->>'sub');

CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  USING (user_id = auth.jwt()->>'sub');

-- RLS Policies for playlists table
CREATE POLICY "Public playlists are viewable by everyone"
  ON playlists FOR SELECT
  USING (is_public = true OR user_id = auth.jwt()->>'sub');

CREATE POLICY "Users can create own playlists"
  ON playlists FOR INSERT
  WITH CHECK (user_id = auth.jwt()->>'sub');

CREATE POLICY "Users can update own playlists"
  ON playlists FOR UPDATE
  USING (user_id = auth.jwt()->>'sub');

CREATE POLICY "Users can delete own playlists"
  ON playlists FOR DELETE
  USING (user_id = auth.jwt()->>'sub');

-- RLS Policies for playlist_songs table
CREATE POLICY "Playlist songs are viewable based on playlist visibility"
  ON playlist_songs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM playlists
      WHERE playlists.id = playlist_songs.playlist_id
      AND (playlists.is_public = true OR playlists.user_id = auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can add songs to own playlists"
  ON playlist_songs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM playlists
      WHERE playlists.id = playlist_songs.playlist_id
      AND playlists.user_id = auth.jwt()->>'sub'
    )
  );

CREATE POLICY "Users can remove songs from own playlists"
  ON playlist_songs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM playlists
      WHERE playlists.id = playlist_songs.playlist_id
      AND playlists.user_id = auth.jwt()->>'sub'
    )
  );

-- RLS Policies for follows table
CREATE POLICY "Follows are viewable by everyone"
  ON follows FOR SELECT
  USING (true);

CREATE POLICY "Users can follow others"
  ON follows FOR INSERT
  WITH CHECK (follower_id = auth.jwt()->>'sub');

CREATE POLICY "Users can unfollow"
  ON follows FOR DELETE
  USING (follower_id = auth.jwt()->>'sub');

-- RLS Policies for credits_history table
CREATE POLICY "Users can view own credit history"
  ON credits_history FOR SELECT
  USING (user_id = auth.jwt()->>'sub');

CREATE POLICY "System can insert credit records"
  ON credits_history FOR INSERT
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_songs_user_id ON songs(user_id);
CREATE INDEX idx_songs_created_at ON songs(created_at DESC);
CREATE INDEX idx_songs_genre ON songs(genre);
CREATE INDEX idx_songs_status ON songs(status);
CREATE INDEX idx_likes_song_id ON likes(song_id);
CREATE INDEX idx_likes_user_id ON likes(user_id);
CREATE INDEX idx_comments_song_id ON comments(song_id);
CREATE INDEX idx_playlists_user_id ON playlists(user_id);
CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);
CREATE INDEX idx_credits_user ON credits_history(user_id);
CREATE INDEX idx_credits_created ON credits_history(created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to update follower counts
CREATE OR REPLACE FUNCTION update_follower_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE users SET follower_count = follower_count + 1 WHERE clerk_user_id = NEW.following_id;
    UPDATE users SET following_count = following_count + 1 WHERE clerk_user_id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE users SET follower_count = follower_count - 1 WHERE clerk_user_id = OLD.following_id;
    UPDATE users SET following_count = following_count - 1 WHERE clerk_user_id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

-- Function to deduct credits on music generation
CREATE OR REPLACE FUNCTION deduct_generation_credit()
RETURNS TRIGGER AS $$
BEGIN
  -- Deduct 1 credit from user
  UPDATE users SET credits = credits - 1, total_generated = total_generated + 1
  WHERE clerk_user_id = NEW.user_id;
  
  -- Log the credit usage
  INSERT INTO credits_history (user_id, amount, reason, song_id)
  VALUES (NEW.user_id, -1, 'generation', NEW.id);
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to add signup bonus credits
CREATE OR REPLACE FUNCTION add_signup_credits()
RETURNS TRIGGER AS $$
BEGIN
  -- Log the signup bonus
  INSERT INTO credits_history (user_id, amount, reason)
  VALUES (NEW.clerk_user_id, 20, 'signup');
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_songs_updated_at BEFORE UPDATE ON songs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_playlists_updated_at BEFORE UPDATE ON playlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for follower counts
CREATE TRIGGER update_follower_counts_trigger
    AFTER INSERT OR DELETE ON follows
    FOR EACH ROW EXECUTE FUNCTION update_follower_counts();

-- Create trigger for credit deduction on song generation
CREATE TRIGGER deduct_credit_on_generation
    AFTER INSERT ON songs
    FOR EACH ROW EXECUTE FUNCTION deduct_generation_credit();

-- Create trigger for signup bonus
CREATE TRIGGER add_signup_bonus
    AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION add_signup_credits();
