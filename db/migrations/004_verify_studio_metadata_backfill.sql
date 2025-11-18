-- Verification script: run after migration `004_add_studio_metadata.sql`
-- Use these queries to verify that metadata/effects have been added/preserved

-- Count library items with metadata
SELECT COUNT(*) AS library_with_metadata FROM public.combined_media_library WHERE metadata IS NOT NULL OR effects IS NOT NULL OR beat_metadata IS NOT NULL OR stems IS NOT NULL;

-- Count published combined media with metadata
SELECT COUNT(*) AS combined_with_metadata FROM public.combined_media WHERE metadata IS NOT NULL OR effects IS NOT NULL OR beat_metadata IS NOT NULL OR stems IS NOT NULL;

-- View a sample of combined_media_library with metadata
SELECT id, clerk_user_id, title, audio_url, created_at, metadata, effects, beat_metadata, stems, is_multi_track
FROM public.combined_media_library
WHERE metadata IS NOT NULL OR effects IS NOT NULL OR beat_metadata IS NOT NULL OR stems IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;

-- View sample of published combined_media
SELECT id, user_id, username, title, audio_url, created_at, metadata, effects, beat_metadata, stems, is_multi_track
FROM public.combined_media
WHERE is_published = TRUE AND (metadata IS NOT NULL OR effects IS NOT NULL OR beat_metadata IS NOT NULL OR stems IS NOT NULL)
ORDER BY created_at DESC
LIMIT 20;
