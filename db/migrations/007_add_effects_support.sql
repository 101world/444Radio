-- Migration: Add support for effects and other audio-only content
-- Allows image_url to be NULL and adds type, prompt, genre, media_url columns

BEGIN;

-- 1. Make image_url nullable (effects don't have images)
ALTER TABLE combined_media 
  ALTER COLUMN image_url DROP NOT NULL;

-- 2. Add type column to distinguish content types (audio, video, image, effects)
ALTER TABLE combined_media 
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'audio';

-- 3. Add prompt column (used by effects and other generators)
ALTER TABLE combined_media 
  ADD COLUMN IF NOT EXISTS prompt TEXT;

-- 4. Add genre column (effects use 'effects' genre)
ALTER TABLE combined_media 
  ADD COLUMN IF NOT EXISTS genre TEXT;

-- 5. Add media_url column (for video-to-audio and other use cases)
ALTER TABLE combined_media 
  ADD COLUMN IF NOT EXISTS media_url TEXT;

-- 6. Create index on type for filtering
CREATE INDEX IF NOT EXISTS idx_combined_media_type 
  ON combined_media(type);

-- 7. Create index on genre for filtering effects
CREATE INDEX IF NOT EXISTS idx_combined_media_genre 
  ON combined_media(genre) 
  WHERE genre IS NOT NULL;

-- 8. Update RLS policies to allow service role to bypass for API inserts
-- (This allows our API routes using SUPABASE_SERVICE_ROLE_KEY to insert)
ALTER TABLE combined_media FORCE ROW LEVEL SECURITY;

COMMIT;

-- Verification
DO $$
BEGIN
  RAISE NOTICE '✅ Migration complete: Effects support added to combined_media';
  RAISE NOTICE '   - image_url is now nullable';
  RAISE NOTICE '   - Added columns: type, prompt, genre, media_url';
  RAISE NOTICE '   - Added indexes on type and genre';
END $$;
