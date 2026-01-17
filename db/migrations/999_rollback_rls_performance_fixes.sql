-- ============================================================================
-- ROLLBACK MIGRATION: Revert RLS Performance Fixes
-- Date: 2026-01-12
-- Purpose: Rollback changes from 999_fix_rls_performance_issues.sql
-- USE THIS ONLY IF: The main migration causes issues in production
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: ROLLBACK AUTH RLS INITPLAN FIXES
-- Restore original auth.uid() calls (without SELECT wrapper)
-- ============================================================================

-- TABLE: users
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (clerk_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own data" ON public.users;
CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE USING (clerk_user_id = auth.uid());

-- TABLE: songs
DROP POLICY IF EXISTS "Users can create own songs" ON public.songs;
CREATE POLICY "Users can create own songs" ON public.songs
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own songs" ON public.songs;
CREATE POLICY "Users can update own songs" ON public.songs
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own songs" ON public.songs;
CREATE POLICY "Users can delete own songs" ON public.songs
  FOR DELETE USING (user_id = auth.uid());

-- TABLE: likes
DROP POLICY IF EXISTS "Users can create own likes" ON public.likes;
CREATE POLICY "Users can create own likes" ON public.likes
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own likes" ON public.likes;
CREATE POLICY "Users can delete own likes" ON public.likes
  FOR DELETE USING (user_id = auth.uid());

-- TABLE: comments
DROP POLICY IF EXISTS "Users can create own comments" ON public.comments;
CREATE POLICY "Users can create own comments" ON public.comments
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own comments" ON public.comments;
CREATE POLICY "Users can update own comments" ON public.comments
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;
CREATE POLICY "Users can delete own comments" ON public.comments
  FOR DELETE USING (user_id = auth.uid());

-- TABLE: playlists
DROP POLICY IF EXISTS "Public playlists are viewable by everyone" ON public.playlists;
CREATE POLICY "Public playlists are viewable by everyone" ON public.playlists
  FOR SELECT USING (is_public = true OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own playlists" ON public.playlists;
CREATE POLICY "Users can create own playlists" ON public.playlists
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own playlists" ON public.playlists;
CREATE POLICY "Users can update own playlists" ON public.playlists
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own playlists" ON public.playlists;
CREATE POLICY "Users can delete own playlists" ON public.playlists
  FOR DELETE USING (user_id = auth.uid());

-- TABLE: playlist_songs
DROP POLICY IF EXISTS "Playlist songs are viewable based on playlist visibility" ON public.playlist_songs;
CREATE POLICY "Playlist songs are viewable based on playlist visibility" ON public.playlist_songs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.playlists 
      WHERE playlists.id = playlist_songs.playlist_id 
      AND (playlists.is_public = true OR playlists.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can add songs to own playlists" ON public.playlist_songs;
CREATE POLICY "Users can add songs to own playlists" ON public.playlist_songs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.playlists 
      WHERE playlists.id = playlist_songs.playlist_id 
      AND playlists.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can remove songs from own playlists" ON public.playlist_songs;
CREATE POLICY "Users can remove songs from own playlists" ON public.playlist_songs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.playlists 
      WHERE playlists.id = playlist_songs.playlist_id 
      AND playlists.user_id = auth.uid()
    )
  );

-- TABLE: follows
DROP POLICY IF EXISTS "Users can follow others" ON public.follows;
CREATE POLICY "Users can follow others" ON public.follows
  FOR INSERT WITH CHECK (follower_id = auth.uid());

DROP POLICY IF EXISTS "Users can unfollow" ON public.follows;
CREATE POLICY "Users can unfollow" ON public.follows
  FOR DELETE USING (follower_id = auth.uid());

-- TABLE: credits_history
DROP POLICY IF EXISTS "Users can view own credit history" ON public.credits_history;
CREATE POLICY "Users can view own credit history" ON public.credits_history
  FOR SELECT USING (clerk_user_id = auth.uid());

-- TABLE: combined_media
DROP POLICY IF EXISTS "Users can view own combined media" ON public.combined_media;
CREATE POLICY "Users can view own combined media" ON public.combined_media
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create combined media" ON public.combined_media;
CREATE POLICY "Users can create combined media" ON public.combined_media
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own combined media" ON public.combined_media;
CREATE POLICY "Users can update own combined media" ON public.combined_media
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own combined media" ON public.combined_media;
CREATE POLICY "Users can delete own combined media" ON public.combined_media
  FOR DELETE USING (user_id = auth.uid());

-- TABLE: images_library
DROP POLICY IF EXISTS "Users can view their own images" ON public.images_library;
CREATE POLICY "Users can view their own images" ON public.images_library
  FOR SELECT USING (clerk_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own images" ON public.images_library;
CREATE POLICY "Users can insert their own images" ON public.images_library
  FOR INSERT WITH CHECK (clerk_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own images" ON public.images_library;
CREATE POLICY "Users can update their own images" ON public.images_library
  FOR UPDATE USING (clerk_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own images" ON public.images_library;
CREATE POLICY "Users can delete their own images" ON public.images_library
  FOR DELETE USING (clerk_user_id = auth.uid());

-- TABLE: videos_library
DROP POLICY IF EXISTS "Users can view their own videos" ON public.videos_library;
CREATE POLICY "Users can view their own videos" ON public.videos_library
  FOR SELECT USING (clerk_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own videos" ON public.videos_library;
CREATE POLICY "Users can insert their own videos" ON public.videos_library
  FOR INSERT WITH CHECK (clerk_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own videos" ON public.videos_library;
CREATE POLICY "Users can update their own videos" ON public.videos_library
  FOR UPDATE USING (clerk_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own videos" ON public.videos_library;
CREATE POLICY "Users can delete their own videos" ON public.videos_library
  FOR DELETE USING (clerk_user_id = auth.uid());

-- TABLE: combined_media_library
DROP POLICY IF EXISTS "Users can view their own combined media" ON public.combined_media_library;
CREATE POLICY "Users can view their own combined media" ON public.combined_media_library
  FOR SELECT USING (clerk_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own combined media" ON public.combined_media_library;
CREATE POLICY "Users can insert their own combined media" ON public.combined_media_library
  FOR INSERT WITH CHECK (clerk_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own combined media" ON public.combined_media_library;
CREATE POLICY "Users can update their own combined media" ON public.combined_media_library
  FOR UPDATE USING (clerk_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own combined media" ON public.combined_media_library;
CREATE POLICY "Users can delete their own combined media" ON public.combined_media_library
  FOR DELETE USING (clerk_user_id = auth.uid());

-- TABLE: live_stations
DROP POLICY IF EXISTS "Users can update own station" ON public.live_stations;
CREATE POLICY "Users can update own station" ON public.live_stations
  FOR UPDATE USING (clerk_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own station" ON public.live_stations;
CREATE POLICY "Users can insert own station" ON public.live_stations
  FOR INSERT WITH CHECK (clerk_user_id = auth.uid());

-- TABLE: station_messages
DROP POLICY IF EXISTS "Authenticated users can send messages" ON public.station_messages;
CREATE POLICY "Authenticated users can send messages" ON public.station_messages
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- TABLE: station_listeners
DROP POLICY IF EXISTS "Authenticated users can join stations" ON public.station_listeners;
CREATE POLICY "Authenticated users can join stations" ON public.station_listeners
  FOR INSERT WITH CHECK (clerk_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can remove themselves" ON public.station_listeners;
CREATE POLICY "Users can remove themselves" ON public.station_listeners
  FOR DELETE USING (clerk_user_id = auth.uid());

-- TABLE: media_likes
DROP POLICY IF EXISTS "Users can create own likes" ON public.media_likes;
CREATE POLICY "Users can create own likes" ON public.media_likes
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own likes" ON public.media_likes;
CREATE POLICY "Users can delete own likes" ON public.media_likes
  FOR DELETE USING (user_id = auth.uid());

-- TABLE: play_credits
DROP POLICY IF EXISTS "Users can view their own play credits" ON public.play_credits;
CREATE POLICY "Users can view their own play credits" ON public.play_credits
  FOR SELECT USING (artist_clerk_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own play credits" ON public.play_credits;
CREATE POLICY "Users can insert their own play credits" ON public.play_credits
  FOR INSERT WITH CHECK (artist_clerk_user_id = auth.uid());

-- TABLE: studio_jobs
DROP POLICY IF EXISTS "Users can view own jobs" ON public.studio_jobs;
CREATE POLICY "Users can view own jobs" ON public.studio_jobs
  FOR SELECT USING (clerk_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own jobs" ON public.studio_jobs;
CREATE POLICY "Users can insert own jobs" ON public.studio_jobs
  FOR INSERT WITH CHECK (clerk_user_id = auth.uid());

-- TABLE: studio_projects
DROP POLICY IF EXISTS "Users can view own projects" ON public.studio_projects;
CREATE POLICY "Users can view own projects" ON public.studio_projects
  FOR SELECT USING (clerk_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own projects" ON public.studio_projects;
CREATE POLICY "Users can create own projects" ON public.studio_projects
  FOR INSERT WITH CHECK (clerk_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own projects" ON public.studio_projects;
CREATE POLICY "Users can update own projects" ON public.studio_projects
  FOR UPDATE USING (clerk_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own projects" ON public.studio_projects;
CREATE POLICY "Users can delete own projects" ON public.studio_projects
  FOR DELETE USING (clerk_user_id = auth.uid());

-- ============================================================================
-- PART 2: RESTORE DUPLICATE POLICIES
-- ============================================================================

-- TABLE: images_library - Restore old "own" policies
CREATE POLICY IF NOT EXISTS "Users can view own images" ON public.images_library
  FOR SELECT USING (clerk_user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can insert own images" ON public.images_library
  FOR INSERT WITH CHECK (clerk_user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can update own images" ON public.images_library
  FOR UPDATE USING (clerk_user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can delete own images" ON public.images_library
  FOR DELETE USING (clerk_user_id = auth.uid());

-- TABLE: videos_library - Restore old policies
CREATE POLICY IF NOT EXISTS "Users can view own videos" ON public.videos_library
  FOR SELECT USING (clerk_user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can insert own videos" ON public.videos_library
  FOR INSERT WITH CHECK (clerk_user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can update own videos" ON public.videos_library
  FOR UPDATE USING (clerk_user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can delete own videos" ON public.videos_library
  FOR DELETE USING (clerk_user_id = auth.uid());

-- TABLE: play_credits - Restore duplicate view policy
CREATE POLICY IF NOT EXISTS "Users can view own play credits" ON public.play_credits
  FOR SELECT USING (artist_clerk_user_id = auth.uid());

-- TABLE: users - Restore old policies
CREATE POLICY IF NOT EXISTS "Users are viewable by everyone" ON public.users
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Users can update own data" ON public.users
  FOR UPDATE USING (clerk_user_id = auth.uid());

-- ============================================================================
-- PART 3: RESTORE DUPLICATE INDEX
-- ============================================================================

-- Recreate the duplicate index
CREATE INDEX IF NOT EXISTS idx_music_library_clerk_user_id 
  ON public.music_library(clerk_user_id);

COMMIT;

-- ============================================================================
-- ROLLBACK COMPLETE
-- Note: This restores the original performance issues. Only use in emergencies.
-- ============================================================================
