-- Add metadata columns to combined_media table for release functionality
-- This enables genre, mood, tags, vocals, language, bpm, description tracking

ALTER TABLE public.combined_media 
ADD COLUMN IF NOT EXISTS audio_prompt TEXT,
ADD COLUMN IF NOT EXISTS image_prompt TEXT,
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS genre TEXT,
ADD COLUMN IF NOT EXISTS mood TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS bpm INTEGER,
ADD COLUMN IF NOT EXISTS vocals TEXT,
ADD COLUMN IF NOT EXISTS language TEXT;

-- Add helpful comments
COMMENT ON COLUMN public.combined_media.audio_prompt IS 'Original prompt used to generate the audio';
COMMENT ON COLUMN public.combined_media.image_prompt IS 'Original prompt used to generate the cover image';
COMMENT ON COLUMN public.combined_media.is_published IS 'Whether this release is published (for releases tab filtering)';
COMMENT ON COLUMN public.combined_media.genre IS 'Music genre (e.g., lofi, hiphop, jazz, techno)';
COMMENT ON COLUMN public.combined_media.mood IS 'Mood/vibe of the track (e.g., chill, energetic, sad)';
COMMENT ON COLUMN public.combined_media.tags IS 'Array of tags for categorization';
COMMENT ON COLUMN public.combined_media.description IS 'Detailed description of the release';
COMMENT ON COLUMN public.combined_media.bpm IS 'Beats per minute';
COMMENT ON COLUMN public.combined_media.vocals IS 'Vocal type (instrumental, with-lyrics, none)';
COMMENT ON COLUMN public.combined_media.language IS 'Language of vocals (english, instrumental, etc)';
