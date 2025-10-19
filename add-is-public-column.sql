-- Add is_public column to songs table
-- Run this in Supabase SQL Editor

-- Add the column
ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Update existing songs to be private by default
UPDATE songs 
SET is_public = false 
WHERE is_public IS NULL;

-- Verify the column was added
SELECT 
  column_name, 
  data_type, 
  column_default 
FROM information_schema.columns 
WHERE table_name = 'songs' 
  AND column_name = 'is_public';

-- Show sample data
SELECT id, title, status, is_public 
FROM songs 
LIMIT 5;
