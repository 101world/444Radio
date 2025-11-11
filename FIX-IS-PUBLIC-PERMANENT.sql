-- PROPER FIX: Set all existing tracks to is_public = true
-- This is the permanent solution for the explore page issue

-- Step 1: Check current state
SELECT 
  'BEFORE UPDATE' as status,
  COUNT(*) as total_tracks,
  COUNT(*) FILTER (WHERE is_public = true) as public_true,
  COUNT(*) FILTER (WHERE is_public = false) as public_false,
  COUNT(*) FILTER (WHERE is_public IS NULL) as public_null
FROM combined_media;

-- Step 2: Update ALL tracks to be public
-- This is correct because combined_media table is ONLY for published releases
UPDATE combined_media
SET is_public = true
WHERE is_public IS NULL OR is_public = false OR is_public != true;

-- Step 3: Verify the fix
SELECT 
  'AFTER UPDATE' as status,
  COUNT(*) as total_tracks,
  COUNT(*) FILTER (WHERE is_public = true) as public_true,
  COUNT(*) FILTER (WHERE is_public = false) as public_false,
  COUNT(*) FILTER (WHERE is_public IS NULL) as public_null
FROM combined_media;

-- Step 4: Set default for future records
ALTER TABLE combined_media 
ALTER COLUMN is_public SET DEFAULT true;

-- Step 5: Add NOT NULL constraint (optional, but recommended)
ALTER TABLE combined_media 
ALTER COLUMN is_public SET NOT NULL;

-- Verification: All tracks should now have is_public = true
SELECT 
  COUNT(*) as total_tracks,
  COUNT(*) FILTER (WHERE is_public = true) as all_should_be_true
FROM combined_media;
