-- 1018: 444Radio Ownership Protocol — Core Infrastructure
-- Replaces ISRC/UPC with 444 Track ID system
-- Adds AI fingerprinting, ownership lockdown, Sonic DNA, and Content DNA engine

-- ============================================================
-- PART 1: 444 TRACK ID + CREATION IDENTITY
-- ============================================================

-- 444 Track ID: format 444-{YYYY}-{USERID_SHORT}-{HASH}
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS track_id_444 TEXT UNIQUE;

-- Creation type: how the content was made
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS creation_type TEXT
  CHECK (creation_type IN (
    'ai_generated',
    'ai_assisted',
    'human_upload',
    'remix_444',
    'stem_derivative'
  ));

-- AI generation metadata (prompt-indexed discovery)
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS generation_prompt TEXT;        -- the actual prompt used
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS generation_model TEXT;         -- model name (MiniMax, ACE-Step, etc.)
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS generation_seed TEXT;          -- seed number for reproducibility
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS generation_date TIMESTAMPTZ;  -- when AI generated it
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS generation_params JSONB;      -- full generation parameters
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS prompt_visibility TEXT DEFAULT 'private'
  CHECK (prompt_visibility IN ('public', 'private'));

-- Version history for iterative generation
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1;
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS previous_version_id UUID REFERENCES combined_media(id) ON DELETE SET NULL;

-- ============================================================
-- PART 2: SONIC DNA — AI-Native Discovery Fields
-- ============================================================

-- Energy level (0-100 scale)
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS energy_level INTEGER
  CHECK (energy_level >= 0 AND energy_level <= 100);

-- Danceability (0-100 scale)
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS danceability INTEGER
  CHECK (danceability >= 0 AND danceability <= 100);

-- Tempo feel
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS tempo_feel TEXT
  CHECK (tempo_feel IN ('slow', 'mid', 'fast'));

-- Atmosphere
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS atmosphere TEXT
  CHECK (atmosphere IN ('dark', 'dreamy', 'uplifting', 'aggressive', 'calm', 'melancholic', 'euphoric', 'mysterious'));

-- Era vibe
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS era_vibe TEXT
  CHECK (era_vibe IN ('70s', '80s', '90s', '2000s', '2010s', 'futuristic', 'retro', 'timeless'));

-- Metadata completeness score (0-100)
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS metadata_strength INTEGER DEFAULT 0
  CHECK (metadata_strength >= 0 AND metadata_strength <= 100);

-- ============================================================
-- PART 3: OWNERSHIP & RIGHTS LOCK (Most Critical)
-- ============================================================

-- Original creator lock — immutable after first set
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS original_creator_id TEXT;   -- Clerk user ID of original creator
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS prompt_author_id TEXT;      -- Who wrote the prompt
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS stem_owner_id TEXT;         -- Owner of source stems
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS voice_model_used TEXT;      -- AI voice model if any

-- License type for 444 ecosystem
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS license_type_444 TEXT DEFAULT 'fully_ownable'
  CHECK (license_type_444 IN (
    'fully_ownable',
    'non_exclusive',
    'remix_allowed',
    'download_only',
    'streaming_only',
    'no_derivatives'
  ));

-- Remix permissions
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS remix_allowed BOOLEAN DEFAULT false;
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS derivative_allowed BOOLEAN DEFAULT false;

-- ============================================================
-- PART 4: AUDIO FINGERPRINT TABLE (Content DNA Engine)
-- ============================================================

CREATE TABLE IF NOT EXISTS audio_fingerprints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id UUID NOT NULL REFERENCES combined_media(id) ON DELETE CASCADE,
  
  -- Waveform fingerprint (perceptual hash of audio)
  waveform_hash TEXT NOT NULL,
  
  -- Stem hashes (individual component fingerprints)
  stem_hash_vocals TEXT,
  stem_hash_drums TEXT,
  stem_hash_bass TEXT,
  stem_hash_melody TEXT,
  stem_hash_other TEXT,
  
  -- Prompt-based fingerprint
  prompt_hash TEXT,
  
  -- Combined AI fingerprint (hash of waveform + stems + prompt + seed)
  ai_fingerprint TEXT NOT NULL,
  
  -- Spectral features for similarity matching
  spectral_centroid NUMERIC,
  spectral_rolloff NUMERIC,
  mfcc_features JSONB,                -- Mel-frequency cepstral coefficients
  chroma_features JSONB,              -- Pitch class profiles
  
  -- Duration and tempo for quick pre-filtering
  duration_ms INTEGER,
  detected_bpm NUMERIC,
  detected_key TEXT,
  
  -- Similarity detection metadata
  fingerprint_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(track_id)
);

ALTER TABLE audio_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on audio_fingerprints"
  ON audio_fingerprints FOR ALL
  USING (auth.role() = 'service_role');

-- Indexes for fast fingerprint lookups
CREATE INDEX IF NOT EXISTS idx_audio_fp_waveform ON audio_fingerprints(waveform_hash);
CREATE INDEX IF NOT EXISTS idx_audio_fp_ai ON audio_fingerprints(ai_fingerprint);
CREATE INDEX IF NOT EXISTS idx_audio_fp_prompt ON audio_fingerprints(prompt_hash) WHERE prompt_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audio_fp_track ON audio_fingerprints(track_id);

-- ============================================================
-- PART 5: TRACK OWNERSHIP LOG (Full Ancestry Tree)
-- ============================================================

CREATE TABLE IF NOT EXISTS track_ownership_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id UUID NOT NULL REFERENCES combined_media(id) ON DELETE CASCADE,
  
  -- Who originated this content
  original_creator_id TEXT NOT NULL,
  
  -- Current holder (changes on purchase/transfer)
  current_owner_id TEXT NOT NULL,
  
  -- Transaction type
  transaction_type TEXT NOT NULL
    CHECK (transaction_type IN (
      'creation',        -- original upload/generation
      'download',        -- free download
      'purchase',        -- earn marketplace purchase
      'remix',           -- remix of existing track
      'stem_split',      -- stems extracted from parent
      'transfer',        -- ownership transfer
      'license_grant'    -- license granted to another user
    )),
  
  -- Lineage: which track was this derived from?
  parent_track_id UUID REFERENCES combined_media(id) ON DELETE SET NULL,
  
  -- License and rights
  license_type TEXT NOT NULL DEFAULT 'fully_ownable',
  derivative_allowed BOOLEAN DEFAULT false,
  
  -- Audio hash at time of transaction (tamper detection)
  audio_hash TEXT,
  
  -- 444 Track ID snapshot
  track_id_444 TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE track_ownership_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on track_ownership_log"
  ON track_ownership_log FOR ALL
  USING (auth.role() = 'service_role');

-- Users can read logs for their own tracks
CREATE POLICY "Users can read own ownership logs"
  ON track_ownership_log FOR SELECT
  USING (
    original_creator_id = auth.jwt()->>'sub'
    OR current_owner_id = auth.jwt()->>'sub'
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ownership_track ON track_ownership_log(track_id);
CREATE INDEX IF NOT EXISTS idx_ownership_creator ON track_ownership_log(original_creator_id);
CREATE INDEX IF NOT EXISTS idx_ownership_owner ON track_ownership_log(current_owner_id);
CREATE INDEX IF NOT EXISTS idx_ownership_parent ON track_ownership_log(parent_track_id) WHERE parent_track_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ownership_type ON track_ownership_log(transaction_type);
CREATE INDEX IF NOT EXISTS idx_ownership_hash ON track_ownership_log(audio_hash) WHERE audio_hash IS NOT NULL;

-- ============================================================
-- PART 6: DOWNLOAD LINEAGE TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS download_lineage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id UUID NOT NULL REFERENCES combined_media(id) ON DELETE CASCADE,
  parent_track_id UUID REFERENCES combined_media(id) ON DELETE SET NULL,
  
  -- Who downloaded
  download_user_id TEXT NOT NULL,
  
  -- What was the original
  original_creator_id TEXT NOT NULL,
  
  -- Permissions at time of download
  derivative_allowed BOOLEAN DEFAULT false,
  remix_allowed BOOLEAN DEFAULT false,
  license_type TEXT NOT NULL DEFAULT 'download_only',
  
  -- 444 Track ID embedded in the downloaded file
  embedded_track_id_444 TEXT,
  
  -- Hash of the file at download time
  download_hash TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE download_lineage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on download_lineage"
  ON download_lineage FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_download_lineage_track ON download_lineage(track_id);
CREATE INDEX IF NOT EXISTS idx_download_lineage_user ON download_lineage(download_user_id);
CREATE INDEX IF NOT EXISTS idx_download_lineage_parent ON download_lineage(parent_track_id) WHERE parent_track_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_download_lineage_hash ON download_lineage(download_hash) WHERE download_hash IS NOT NULL;

-- ============================================================
-- PART 7: REUPLOAD DETECTION LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS reupload_detections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- The upload that was flagged
  flagged_track_id UUID REFERENCES combined_media(id) ON DELETE SET NULL,
  flagged_user_id TEXT NOT NULL,
  
  -- The original track it matches
  original_track_id UUID NOT NULL REFERENCES combined_media(id) ON DELETE CASCADE,
  original_creator_id TEXT NOT NULL,
  original_track_id_444 TEXT,
  
  -- Detection method and confidence
  detection_method TEXT NOT NULL
    CHECK (detection_method IN (
      'exact_hash',           -- identical audio hash
      'waveform_similarity',  -- perceptual audio match
      'stem_similarity',      -- stem component match
      'prompt_similarity',    -- same/similar prompt+seed
      'metadata_match',       -- embedded 444 metadata found
      'spectral_match'        -- spectral feature similarity
    )),
  similarity_score NUMERIC,    -- 0.0 to 1.0
  
  -- What happened
  resolution TEXT DEFAULT 'pending'
    CHECK (resolution IN (
      'pending',           -- awaiting review
      'blocked',           -- upload blocked
      'allowed_as_remix',  -- user chose remix path
      'credited_original', -- original creator credited
      'dismissed',         -- false positive / admin override
      'appealed'           -- user disputed detection
    )),
  
  -- Details
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE reupload_detections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on reupload_detections"
  ON reupload_detections FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_reupload_flagged ON reupload_detections(flagged_user_id);
CREATE INDEX IF NOT EXISTS idx_reupload_original ON reupload_detections(original_track_id);
CREATE INDEX IF NOT EXISTS idx_reupload_resolution ON reupload_detections(resolution);

-- ============================================================
-- PART 8: DEPRECATE ISRC/UPC, REPLACE WITH 444 SYSTEM
-- ============================================================

-- Mark legacy columns as deprecated (don't drop to avoid breaking existing queries)
COMMENT ON COLUMN combined_media.isrc IS 'DEPRECATED: Use track_id_444 instead. 444Radio uses its own identification system.';
COMMENT ON COLUMN combined_media.upc IS 'DEPRECATED: Use track_id_444 instead. 444Radio uses its own identification system.';

-- ============================================================
-- PART 9: UPDATE SEARCH VECTOR FOR NEW FIELDS
-- ============================================================

-- Drop and recreate the search vector function to include new fields
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
    setweight(to_tsvector('english', COALESCE(NEW.generation_prompt, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.mood, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.atmosphere, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.era_vibe, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.tempo_feel, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.version_tag, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.record_label, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.publisher, '')), 'D') ||
    setweight(to_tsvector('english', COALESCE(NEW.key_signature, '')), 'D') ||
    setweight(to_tsvector('english', COALESCE(NEW.lyrics, '')), 'D') ||
    setweight(to_tsvector('english', COALESCE(NEW.voice_model_used, '')), 'D') ||
    setweight(to_tsvector('english', COALESCE(NEW.generation_model, '')), 'D') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.keywords, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.mood_tags, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.instruments, ' '), '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.featured_artists, ' '), '')), 'A');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_combined_media_track_id_444 ON combined_media(track_id_444) WHERE track_id_444 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_combined_media_creation_type ON combined_media(creation_type) WHERE creation_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_combined_media_license_type ON combined_media(license_type_444);
CREATE INDEX IF NOT EXISTS idx_combined_media_energy ON combined_media(energy_level) WHERE energy_level IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_combined_media_danceability ON combined_media(danceability) WHERE danceability IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_combined_media_atmosphere ON combined_media(atmosphere) WHERE atmosphere IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_combined_media_era_vibe ON combined_media(era_vibe) WHERE era_vibe IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_combined_media_original_creator ON combined_media(original_creator_id) WHERE original_creator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_combined_media_generation_model ON combined_media(generation_model) WHERE generation_model IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_combined_media_prompt_visibility ON combined_media(prompt_visibility) WHERE prompt_visibility = 'public';
CREATE INDEX IF NOT EXISTS idx_combined_media_remix_allowed ON combined_media(remix_allowed) WHERE remix_allowed = true;

-- ============================================================
-- PART 10: HELPER FUNCTION — Generate 444 Track ID
-- ============================================================

CREATE OR REPLACE FUNCTION generate_444_track_id(p_user_id TEXT) RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_user_short TEXT;
  v_hash TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM now())::TEXT;
  v_user_short := UPPER(SUBSTRING(md5(p_user_id) FROM 1 FOR 4));
  v_hash := UPPER(SUBSTRING(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 6));
  RETURN '444-' || v_year || '-' || v_user_short || '-' || v_hash;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PART 11: AUTO-ASSIGN 444 TRACK ID ON INSERT
-- ============================================================

CREATE OR REPLACE FUNCTION auto_assign_444_track_id() RETURNS trigger AS $$
BEGIN
  -- Only assign if not already set and has a user_id
  IF NEW.track_id_444 IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.track_id_444 := generate_444_track_id(NEW.user_id);
  END IF;
  
  -- Auto-set original_creator_id if not set
  IF NEW.original_creator_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.original_creator_id := NEW.user_id;
  END IF;
  
  -- Auto-set prompt_author_id if not set and there's a prompt
  IF NEW.prompt_author_id IS NULL AND NEW.user_id IS NOT NULL AND (NEW.prompt IS NOT NULL OR NEW.generation_prompt IS NOT NULL) THEN
    NEW.prompt_author_id := NEW.user_id;
  END IF;
  
  -- Auto-detect creation_type if not set
  IF NEW.creation_type IS NULL THEN
    IF NEW.parent_track_id IS NOT NULL AND NEW.stem_type IS NOT NULL THEN
      NEW.creation_type := 'stem_derivative';
    ELSIF NEW.parent_track_id IS NOT NULL THEN
      NEW.creation_type := 'remix_444';
    ELSIF NEW.generation_prompt IS NOT NULL OR NEW.audio_prompt IS NOT NULL OR NEW.prompt IS NOT NULL THEN
      NEW.creation_type := 'ai_generated';
    ELSE
      NEW.creation_type := 'human_upload';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_444_track_id_trigger ON combined_media;
CREATE TRIGGER auto_444_track_id_trigger
  BEFORE INSERT ON combined_media
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_444_track_id();

-- ============================================================
-- PART 12: IMMUTABLE CREATOR LOCK (Prevent Ownership Tampering)
-- ============================================================

CREATE OR REPLACE FUNCTION protect_original_creator() RETURNS trigger AS $$
BEGIN
  -- Once original_creator_id is set, it cannot be changed
  IF OLD.original_creator_id IS NOT NULL AND NEW.original_creator_id != OLD.original_creator_id THEN
    RAISE EXCEPTION '444Radio: Original creator cannot be changed. Track ID: %', OLD.track_id_444;
  END IF;
  
  -- Once track_id_444 is set, it cannot be changed
  IF OLD.track_id_444 IS NOT NULL AND NEW.track_id_444 != OLD.track_id_444 THEN
    RAISE EXCEPTION '444Radio: Track ID cannot be changed once assigned. Track ID: %', OLD.track_id_444;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_creator_lock_trigger ON combined_media;
CREATE TRIGGER protect_creator_lock_trigger
  BEFORE UPDATE ON combined_media
  FOR EACH ROW
  EXECUTE FUNCTION protect_original_creator();

-- ============================================================
-- PART 13: BACKFILL EXISTING TRACKS WITH 444 TRACK IDs
-- ============================================================

-- Assign 444 Track IDs to all existing tracks that don't have one
UPDATE combined_media 
SET 
  track_id_444 = generate_444_track_id(user_id),
  original_creator_id = COALESCE(original_creator_id, user_id),
  creation_type = CASE
    WHEN parent_track_id IS NOT NULL AND stem_type IS NOT NULL THEN 'stem_derivative'
    WHEN parent_track_id IS NOT NULL THEN 'remix_444'
    WHEN prompt IS NOT NULL OR audio_prompt IS NOT NULL THEN 'ai_generated'
    ELSE 'human_upload'
  END
WHERE track_id_444 IS NULL AND user_id IS NOT NULL;
