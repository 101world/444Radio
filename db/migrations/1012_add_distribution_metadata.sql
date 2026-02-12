-- Add distribution-quality metadata columns to combined_media
-- These fields match what major distributors (DistroKid, TuneCore, etc.) require

-- === RELEASE-LEVEL METADATA ===

-- Release type: single, ep, album
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS release_type TEXT DEFAULT 'single';

-- Primary artist name (exact display name for storefronts)
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS artist_name TEXT;

-- Featured artists (comma-separated or array)
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS featured_artists TEXT[];

-- Release date (scheduled publish date)
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS release_date TIMESTAMPTZ;

-- Secondary genre
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS secondary_genre TEXT;

-- Explicit content flag
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS is_explicit BOOLEAN DEFAULT false;

-- Record label name
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS record_label TEXT;

-- Catalogue number
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS catalogue_number TEXT;

-- === TRACK-LEVEL IDENTIFIERS ===

-- ISRC (International Standard Recording Code) - unique per track
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS isrc TEXT;

-- UPC/Barcode (for releases)
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS upc TEXT;

-- ISWC (International Standard Musical Work Code) - publishing
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS iswc TEXT;

-- === CREDITS & CONTRIBUTORS ===

-- Songwriter(s) / composer(s) - JSONB array of { name, role }
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS songwriters JSONB DEFAULT '[]';

-- Contributors / performer roles - JSONB array of { name, role }
-- Roles: producer, engineer, remixer, featured_artist, vocalist, etc.
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS contributors JSONB DEFAULT '[]';

-- Publisher name(s)
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS publisher TEXT;

-- Publishing splits - JSONB { publisher_name: percentage }
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS publishing_splits JSONB;

-- === RIGHTS & LEGAL ===

-- Copyright holder name
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS copyright_holder TEXT;

-- Copyright year
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS copyright_year INTEGER;

-- Is this a cover? 
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS is_cover BOOLEAN DEFAULT false;

-- PRO affiliation (BMI, ASCAP, PRS, etc.)
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS pro_affiliation TEXT;

-- === TECHNICAL METADATA ===

-- Duration in seconds (from audio file)
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC;

-- Audio format info (wav, mp3, flac, etc.)
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS audio_format TEXT;

-- Sample rate (44100, 48000, 96000, etc.)
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS sample_rate INTEGER;

-- Bit depth (16, 24, 32)
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS bit_depth INTEGER;

-- Key signature (C, Am, F#m, etc.)  
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS key_signature TEXT;

-- === DISTRIBUTION & DISCOVERABILITY ===

-- Territories (worldwide or specific country codes)
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS territories TEXT[] DEFAULT '{worldwide}';

-- Version tag (Original, Remix, Radio Edit, Acoustic, etc.)
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS version_tag TEXT;

-- Searchable keywords (for our platform search engine)
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS keywords TEXT[];

-- Mood tags (expanded from single mood field)
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS mood_tags TEXT[];

-- Instruments used
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS instruments TEXT[];

-- === FULL-TEXT SEARCH SUPPORT ===

-- Add a tsvector column for fast full-text search
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create a function to build the search vector from all searchable fields
CREATE OR REPLACE FUNCTION combined_media_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.artist_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.genre, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.secondary_genre, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.prompt, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.audio_prompt, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.mood, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.version_tag, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.record_label, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.publisher, '')), 'D') ||
    setweight(to_tsvector('english', COALESCE(NEW.key_signature, '')), 'D') ||
    setweight(to_tsvector('english', COALESCE(NEW.lyrics, '')), 'D') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.keywords, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.mood_tags, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.instruments, ' '), '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.featured_artists, ' '), '')), 'A');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update search_vector on insert/update
DROP TRIGGER IF EXISTS combined_media_search_vector_trigger ON combined_media;
CREATE TRIGGER combined_media_search_vector_trigger
  BEFORE INSERT OR UPDATE ON combined_media
  FOR EACH ROW
  EXECUTE FUNCTION combined_media_search_vector_update();

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_combined_media_search_vector ON combined_media USING GIN(search_vector);

-- Additional indexes for common filter queries
CREATE INDEX IF NOT EXISTS idx_combined_media_genre ON combined_media(genre);
CREATE INDEX IF NOT EXISTS idx_combined_media_secondary_genre ON combined_media(secondary_genre);
CREATE INDEX IF NOT EXISTS idx_combined_media_bpm ON combined_media(bpm);
CREATE INDEX IF NOT EXISTS idx_combined_media_is_explicit ON combined_media(is_explicit);
CREATE INDEX IF NOT EXISTS idx_combined_media_release_type ON combined_media(release_type);
CREATE INDEX IF NOT EXISTS idx_combined_media_key_signature ON combined_media(key_signature);
CREATE INDEX IF NOT EXISTS idx_combined_media_artist_name ON combined_media(artist_name);
CREATE INDEX IF NOT EXISTS idx_combined_media_tags ON combined_media USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_combined_media_keywords ON combined_media USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_combined_media_mood_tags ON combined_media USING GIN(mood_tags);
CREATE INDEX IF NOT EXISTS idx_combined_media_instruments ON combined_media USING GIN(instruments);
CREATE INDEX IF NOT EXISTS idx_combined_media_isrc ON combined_media(isrc);

-- Backfill search_vector for existing rows
UPDATE combined_media SET search_vector = 
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(genre, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(prompt, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(audio_prompt, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(mood, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(lyrics, '')), 'D') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(tags, ' '), '')), 'B')
WHERE search_vector IS NULL;
