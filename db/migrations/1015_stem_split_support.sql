-- Allow image_url to be NULL for stems (they don't have cover art)
ALTER TABLE combined_media ALTER COLUMN image_url DROP NOT NULL;

-- Add parent_track_id to link stems back to their source track
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS parent_track_id UUID REFERENCES combined_media(id) ON DELETE SET NULL;

-- Add stem_type to identify which stem (vocals, drums, bass, other, etc.)
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS stem_type TEXT;

-- Index for fast stem lookups by parent
CREATE INDEX IF NOT EXISTS idx_combined_media_parent_track ON combined_media(parent_track_id) WHERE parent_track_id IS NOT NULL;

-- Index for fast stem genre filter
CREATE INDEX IF NOT EXISTS idx_combined_media_stem_genre ON combined_media(genre) WHERE genre = 'stem';
