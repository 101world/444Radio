psql $env:PG_CONNECTION_STRING -c "
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
"