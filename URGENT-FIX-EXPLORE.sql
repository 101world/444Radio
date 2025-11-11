-- URGENT FIX: Make all existing releases visible on explore page
-- Run this in Supabase SQL Editor NOW

-- Step 1: Check current state
SELECT 
  COUNT(*) as total_tracks,
  COUNT(*) FILTER (WHERE is_public = true) as visible_on_explore,
  COUNT(*) FILTER (WHERE is_public = false) as hidden_false,
  COUNT(*) FILTER (WHERE is_public IS NULL) as hidden_null
FROM combined_media;

-- Step 2: Fix all tracks to be public
-- This makes ALL releases visible on explore page
UPDATE combined_media
SET is_public = true
WHERE is_public IS NULL OR is_public = false;

-- Step 3: Verify the fix worked
SELECT 
  COUNT(*) as total_tracks,
  COUNT(*) FILTER (WHERE is_public = true) as now_visible,
  COUNT(*) FILTER (WHERE is_public = false) as still_hidden
FROM combined_media;

-- Step 4: Show sample of fixed tracks
SELECT 
  id,
  title,
  user_id,
  is_public,
  created_at
FROM combined_media
ORDER BY created_at DESC
LIMIT 20;
