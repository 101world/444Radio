-- Check if migration 1005 fully applied
-- Should return 0 rows if all policies are optimized

SELECT 
  schemaname, 
  tablename, 
  policyname,
  cmd,
  CASE 
    WHEN cmd IN ('INSERT') THEN with_check::text
    ELSE qual::text
  END as policy_clause
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('songs', 'likes', 'comments', 'playlists', 'playlist_songs', 
                  'follows', 'credits_history', 'combined_media', 'images_library',
                  'videos_library', 'combined_media_library', 'live_stations',
                  'station_messages', 'station_listeners', 'media_likes', 
                  'play_credits', 'studio_jobs', 'studio_projects', 'users')
AND (
  -- Check USING clause (for SELECT/UPDATE/DELETE)
  (qual::text LIKE '%auth.uid()%' AND qual::text NOT LIKE '%( SELECT%auth.uid()%')
  OR
  -- Check WITH CHECK clause (for INSERT)
  (with_check::text LIKE '%auth.uid()%' AND with_check::text NOT LIKE '%( SELECT%auth.uid()%')
)
ORDER BY tablename, policyname;
