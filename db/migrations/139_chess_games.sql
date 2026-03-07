-- Chess games table for multiplayer with credit wagers
CREATE TABLE IF NOT EXISTS chess_games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  white_player_id TEXT NOT NULL,
  black_player_id TEXT NOT NULL,
  wager INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'declined', 'cancelled')),
  winner_id TEXT,
  result TEXT CHECK (result IN ('white', 'black', 'draw', NULL)),
  moves JSONB NOT NULL DEFAULT '[]'::jsonb,
  fen TEXT DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for querying games by player
CREATE INDEX IF NOT EXISTS idx_chess_games_white ON chess_games(white_player_id);
CREATE INDEX IF NOT EXISTS idx_chess_games_black ON chess_games(black_player_id);
CREATE INDEX IF NOT EXISTS idx_chess_games_status ON chess_games(status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_chess_games_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chess_games_updated_at ON chess_games;
CREATE TRIGGER chess_games_updated_at
  BEFORE UPDATE ON chess_games
  FOR EACH ROW
  EXECUTE FUNCTION update_chess_games_updated_at();
