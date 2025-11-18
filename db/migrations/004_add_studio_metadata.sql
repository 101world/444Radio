-- MIGRATION: Add studio metadata fields to combined_media and combined_media_library
-- Adds: metadata JSONB, effects JSONB, beat_metadata JSONB, stems JSONB, is_multi_track BOOLEAN
-- Also attempts a safe backfill from music_library if specific columns exist there

BEGIN;

-- Add columns to combined_media_library (user library)
ALTER TABLE IF EXISTS public.combined_media_library
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS effects JSONB,
  ADD COLUMN IF NOT EXISTS beat_metadata JSONB,
  ADD COLUMN IF NOT EXISTS stems JSONB,
  ADD COLUMN IF NOT EXISTS is_multi_track BOOLEAN DEFAULT FALSE;

-- Add columns to combined_media (public/explore table)
ALTER TABLE IF EXISTS public.combined_media
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS effects JSONB,
  ADD COLUMN IF NOT EXISTS beat_metadata JSONB,
  ADD COLUMN IF NOT EXISTS stems JSONB,
  ADD COLUMN IF NOT EXISTS is_multi_track BOOLEAN DEFAULT FALSE;

-- Create GIN indexes for efficient JSONB queries (only if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='combined_media_library' AND column_name='metadata') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_combined_media_library_metadata ON public.combined_media_library USING gin(metadata)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='combined_media' AND column_name='metadata') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_combined_media_metadata ON public.combined_media USING gin(metadata)';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Backfill: If columns exist in music_library, push into library metadata
-- This backfill will only run for columns that exist, preventing 42703 errors
DO $$
DECLARE
  has_effects BOOLEAN := EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='music_library' AND column_name='effects');
  has_beats BOOLEAN := EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='music_library' AND column_name='beat_metadata');
  has_stems BOOLEAN := EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='music_library' AND column_name='stems');
BEGIN
  -- Only update metadata if at least one source column exists
  IF has_effects OR has_beats OR has_stems THEN
    -- For each field that exists, merge into metadata JSONb if not already set
    IF has_effects THEN
      UPDATE public.combined_media_library c
      SET metadata = COALESCE(c.metadata, '{}'::jsonb) || jsonb_build_object('effects', ml.effects)
      FROM public.music_library ml
      WHERE c.music_id IS NOT NULL AND ml.id = c.music_id
        AND (c.metadata->'effects') IS NULL;
    END IF;

    IF has_beats THEN
      UPDATE public.combined_media_library c
      SET metadata = COALESCE(c.metadata, '{}'::jsonb) || jsonb_build_object('beat_metadata', ml.beat_metadata)
      FROM public.music_library ml
      WHERE c.music_id IS NOT NULL AND ml.id = c.music_id
        AND (c.metadata->'beat_metadata') IS NULL;
    END IF;

    IF has_stems THEN
      UPDATE public.combined_media_library c
      SET metadata = COALESCE(c.metadata, '{}'::jsonb) || jsonb_build_object('stems', ml.stems)
      FROM public.music_library ml
      WHERE c.music_id IS NOT NULL AND ml.id = c.music_id
        AND (c.metadata->'stems') IS NULL;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- Sanity checks (SELECTs) you can run after migration to verify changes
-- SELECT count(*) FROM public.combined_media_library WHERE metadata IS NOT NULL;
-- SELECT count(*) FROM public.combined_media WHERE metadata IS NOT NULL;
