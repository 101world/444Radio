-- Add banner_url column to users table for profile banner customization

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS banner_url TEXT,
ADD COLUMN IF NOT EXISTS banner_type TEXT DEFAULT 'image'; -- 'image' or 'video'

-- Add index
CREATE INDEX IF NOT EXISTS idx_users_banner ON users(banner_url) WHERE banner_url IS NOT NULL;

-- Comment
COMMENT ON COLUMN users.banner_url IS 'Custom banner image or video URL for profile page';
COMMENT ON COLUMN users.banner_type IS 'Type of banner content: image or video';
