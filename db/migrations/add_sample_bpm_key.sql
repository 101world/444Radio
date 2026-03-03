-- Add original BPM and key columns to nde_samples
-- Used at import time to calculate pitch compensation when project BPM differs
-- original_bpm: detected or user-input BPM of the sample's source material
-- original_key: musical key of the sample (e.g. "Cm", "F#", "Ab") — for future use

ALTER TABLE nde_samples ADD COLUMN IF NOT EXISTS original_bpm INTEGER;
ALTER TABLE nde_samples ADD COLUMN IF NOT EXISTS original_key TEXT;
