-- ============================================================================
-- POST-MIGRATION: Update Query Statistics
-- Run after 999_fix_rls_performance_issues.sql
-- ============================================================================

-- Update table statistics for query planner optimization
ANALYZE public.users;
ANALYZE public.combined_media;
ANALYZE public.songs;
ANALYZE public.playlists;
ANALYZE public.images_library;
ANALYZE public.videos_library;
ANALYZE public.combined_media_library;
ANALYZE public.play_credits;
ANALYZE public.studio_projects;
ANALYZE public.live_stations;
ANALYZE public.follows;
ANALYZE public.likes;
ANALYZE public.comments;
ANALYZE public.media_likes;
ANALYZE public.station_listeners;
ANALYZE public.station_messages;
ANALYZE public.studio_jobs;
ANALYZE public.credits_history;

-- Verify optimization applied (should return no rows)
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
AND (qual::text LIKE '%auth.uid()%' OR with_check::text LIKE '%auth.uid()%')
AND qual::text NOT LIKE '%(SELECT auth.uid())%'
AND with_check::text NOT LIKE '%(SELECT auth.uid())%';
