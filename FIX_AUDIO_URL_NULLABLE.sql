-- =====================================================
-- 444Radio - Make audio_url and image_url NULLABLE
-- Required for image-only and video-only uploads
-- =====================================================

-- Remove NOT NULL constraint from audio_url (needed for image/video uploads)
ALTER TABLE combined_media 
ALTER COLUMN audio_url DROP NOT NULL;

-- Remove NOT NULL constraint from image_url (needed for audio-only uploads)
ALTER TABLE combined_media 
ALTER COLUMN image_url DROP NOT NULL;

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'combined_media' 
  AND column_name IN ('audio_url', 'image_url')
ORDER BY column_name;
