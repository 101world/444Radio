-- Add profile_image_url column to store Clerk profile images
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- Update existing users with their Clerk profile images (will be done via webhook on next login)
