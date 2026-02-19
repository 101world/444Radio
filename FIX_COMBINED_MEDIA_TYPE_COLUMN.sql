-- =====================================================
-- 444Radio - Add TYPE column to combined_media (CRITICAL FIX)
-- Run this IMMEDIATELY in Supabase SQL Editor
-- This fixes the 500 error on image uploads for visualizers
-- =====================================================

-- Add type column (required by upload endpoint)
ALTER TABLE combined_media 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'music';

-- Add supporting columns from migration 006
ALTER TABLE combined_media 
ADD COLUMN IF NOT EXISTS media_url TEXT;

ALTER TABLE combined_media 
ADD COLUMN IF NOT EXISTS prompt TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_combined_media_type 
ON combined_media(type);

CREATE INDEX IF NOT EXISTS idx_combined_media_media_url 
ON combined_media(media_url) 
WHERE media_url IS NOT NULL;

-- Verify the columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'combined_media' 
  AND column_name IN ('type', 'media_url', 'prompt')
ORDER BY column_name;
