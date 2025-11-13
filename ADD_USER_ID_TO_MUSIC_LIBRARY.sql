-- Add user_id column to music_library table
ALTER TABLE music_library ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Copy clerk_user_id to user_id (they're the same)
UPDATE music_library SET user_id = clerk_user_id WHERE user_id IS NULL;

-- Create index on user_id
CREATE INDEX IF NOT EXISTS idx_music_library_user_id ON music_library(user_id);

-- Now music_library has BOTH columns and can match either ID format
SELECT 'music_library now has both user_id and clerk_user_id columns!' as status;

-- Verify
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'music_library' 
AND column_name IN ('user_id', 'clerk_user_id')
ORDER BY column_name;
