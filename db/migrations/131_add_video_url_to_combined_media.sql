-- Migration 131: Add video_url column to combined_media table
-- Visualizer (444 Engine) generates videos stored via media_url,
-- but many components (explore, library, release modal) expect video_url.

-- Add the column
ALTER TABLE combined_media
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Backfill: copy media_url → video_url for existing type='video' rows
UPDATE combined_media
SET video_url = media_url
WHERE type = 'video'
  AND video_url IS NULL
  AND media_url IS NOT NULL;

-- Also backfill audio_url for video rows that are missing it (NOT NULL constraint workaround)
UPDATE combined_media
SET audio_url = COALESCE(audio_url, media_url, '')
WHERE type = 'video'
  AND (audio_url IS NULL OR audio_url = '');

UPDATE combined_media
SET image_url = COALESCE(image_url, media_url, '')
WHERE type = 'video'
  AND (image_url IS NULL OR image_url = '');

-- Index for video lookups
CREATE INDEX IF NOT EXISTS idx_combined_media_video_url
ON combined_media(video_url)
WHERE video_url IS NOT NULL;

COMMENT ON COLUMN combined_media.video_url IS 'Permanent R2 URL for video file (visualizer / video SFX)';
