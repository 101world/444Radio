-- Fix is_public for existing combined_media tracks
-- This ensures all releases are visible on explore page

-- First, check current state
SELECT 
  COUNT(*) as total_tracks,
  COUNT(*) FILTER (WHERE is_public = true) as public_tracks,
  COUNT(*) FILTER (WHERE is_public = false) as private_tracks,
  COUNT(*) FILTER (WHERE is_public IS NULL) as null_tracks
FROM combined_media;

-- Update all existing combined_media tracks to be public
-- (since they were created through the release flow which should make them public)
UPDATE combined_media
SET is_public = true
WHERE is_public IS NULL OR is_public = false;

-- Verify the fix
SELECT 
  COUNT(*) as total_tracks,
  COUNT(*) FILTER (WHERE is_public = true) as public_tracks,
  COUNT(*) FILTER (WHERE is_public = false) as private_tracks,
  COUNT(*) FILTER (WHERE is_public IS NULL) as null_tracks
FROM combined_media;

-- Show sample tracks
SELECT 
  id,
  title,
  user_id,
  is_public,
  created_at
FROM combined_media
ORDER BY created_at DESC
LIMIT 10;
