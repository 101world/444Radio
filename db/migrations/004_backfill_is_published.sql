-- 004_backfill_is_published.sql
-- Backfill is_published for combined_media and combined_media_library where both audio and image URLs are present

BEGIN;

-- Update combined_media
UPDATE combined_media
SET is_published = true
WHERE audio_url IS NOT NULL
  AND image_url IS NOT NULL
  AND (is_published IS NULL OR is_published = false);

-- Update combined_media_library
UPDATE combined_media_library
SET is_published = true
WHERE audio_url IS NOT NULL
  AND image_url IS NOT NULL
  AND (is_published IS NULL OR is_published = false);

COMMIT;
