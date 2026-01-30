-- Fix library titles that show timestamp filenames instead of actual titles
-- Pattern: "1769771005072-Dreamland-Jazzbeat-1769771004543" should become "Dreamland Jazzbeat"

-- Step 1: Check current state
SELECT id, title, audio_url, created_at
FROM music_library
WHERE title ~ '^\d+-.*-\d+$'  -- Titles that start with digit, end with digit (timestamp pattern)
ORDER BY created_at DESC
LIMIT 20;

-- Step 2: Extract clean title from timestamp-based filenames
-- Pattern: Remove leading timestamp, remove trailing timestamp, replace hyphens with spaces
UPDATE music_library
SET title = CASE
  -- If title matches pattern like "1234567890-Title-Words-1234567890"
  WHEN title ~ '^\d+-.*-\d+$' THEN
    -- Extract the middle part (remove leading and trailing timestamps)
    TRIM(REGEXP_REPLACE(
      REGEXP_REPLACE(title, '^\d+-', ''),  -- Remove leading timestamp
      '-\d+$', ''                           -- Remove trailing timestamp
    ))
  -- If title matches pattern like "Title-Words-1234567890" (only trailing timestamp)
  WHEN title ~ '^[A-Za-z].*-\d+$' THEN
    TRIM(REGEXP_REPLACE(title, '-\d+$', ''))  -- Remove trailing timestamp
  ELSE title
END
WHERE title ~ '^\d+-.*-\d+$' OR title ~ '^[A-Za-z].*-\d+$';

-- Step 3: Replace remaining hyphens with spaces for better readability
UPDATE music_library
SET title = REPLACE(title, '-', ' ')
WHERE title LIKE '%-%';

-- Step 4: Verify the fix
SELECT id, title, audio_url, created_at
FROM music_library
WHERE audio_url IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;

-- Also fix combined_media table if needed
UPDATE combined_media
SET title = CASE
  WHEN title ~ '^\d+-.*-\d+$' THEN
    TRIM(REGEXP_REPLACE(
      REGEXP_REPLACE(title, '^\d+-', ''),
      '-\d+$', ''
    ))
  WHEN title ~ '^[A-Za-z].*-\d+$' THEN
    TRIM(REGEXP_REPLACE(title, '-\d+$', ''))
  ELSE title
END
WHERE type = 'audio' AND (title ~ '^\d+-.*-\d+$' OR title ~ '^[A-Za-z].*-\d+$');

-- Replace hyphens with spaces in combined_media
UPDATE combined_media
SET title = REPLACE(title, '-', ' ')
WHERE type = 'audio' AND title LIKE '%-%';

-- Also fix combined_media_library if needed
UPDATE combined_media_library
SET title = CASE
  WHEN title ~ '^\d+-.*-\d+$' THEN
    TRIM(REGEXP_REPLACE(
      REGEXP_REPLACE(title, '^\d+-', ''),
      '-\d+$', ''
    ))
  WHEN title ~ '^[A-Za-z].*-\d+$' THEN
    TRIM(REGEXP_REPLACE(title, '-\d+$', ''))
  ELSE title
END
WHERE title ~ '^\d+-.*-\d+$' OR title ~ '^[A-Za-z].*-\d+$';

-- Replace hyphens with spaces in combined_media_library
UPDATE combined_media_library
SET title = REPLACE(title, '-', ' ')
WHERE title LIKE '%-%';
