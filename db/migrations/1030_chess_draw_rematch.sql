-- Migration 1030: Add draw rematch columns to chess_games
--
-- When a game ends in a draw, instead of immediately refunding, the game
-- enters 'draw_pending' status. Each player can choose to rematch (same wager)
-- or take a refund. If both choose rematch, a new game is auto-created.

ALTER TABLE chess_games ADD COLUMN IF NOT EXISTS draw_rematch_white BOOLEAN DEFAULT FALSE;
ALTER TABLE chess_games ADD COLUMN IF NOT EXISTS draw_rematch_black BOOLEAN DEFAULT FALSE;
ALTER TABLE chess_games ADD COLUMN IF NOT EXISTS parent_game_id UUID REFERENCES chess_games(id) DEFAULT NULL;
