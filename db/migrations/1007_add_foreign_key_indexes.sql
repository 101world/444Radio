-- ============================================================================
-- ADD FOREIGN KEY INDEXES FOR QUERY PERFORMANCE
-- Date: 2026-01-12
-- Fixes 3 unindexed foreign key warnings from Supabase linter
-- ============================================================================

-- Index for comments -> users relationship
-- Speeds up queries like: "Get all comments by user X"
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);

-- Index for credits_history -> songs relationship
-- Speeds up queries like: "Get credit history for song Y"
CREATE INDEX IF NOT EXISTS idx_credits_history_song_id ON public.credits_history(song_id);

-- Index for playlist_songs -> songs relationship
-- Speeds up queries like: "Find all playlists containing song Z"
CREATE INDEX IF NOT EXISTS idx_playlist_songs_song_id ON public.playlist_songs(song_id);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Foreign key indexes created:';
  RAISE NOTICE '   - comments.user_id';
  RAISE NOTICE '   - credits_history.song_id';
  RAISE NOTICE '   - playlist_songs.song_id';
END $$;
