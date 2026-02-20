-- ============================================================
-- Add Chords Support: Chord Progressions & Time Signatures
-- ============================================================
-- Adds chord progression and time signature columns to combined_media
-- Updates credit_transactions type enum to include generation_chords
--
-- Date: 2026-02-20
-- ============================================================

-- 1. Add chord progression and time signature to combined_media
ALTER TABLE combined_media 
  ADD COLUMN IF NOT EXISTS chord_progression TEXT,
  ADD COLUMN IF NOT EXISTS time_signature TEXT DEFAULT '4/4';

-- Add helpful comments
COMMENT ON COLUMN combined_media.chord_progression IS 'Chord progression used (e.g., C G A:min F or A:min7 D:min7 E:7)';
COMMENT ON COLUMN combined_media.time_signature IS 'Time signature (e.g., 4/4, 3/4, 6/8)';

-- Create index for searching by chords (helpful for future chord-based search)
CREATE INDEX IF NOT EXISTS idx_combined_media_chord_progression ON combined_media(chord_progression) WHERE chord_progression IS NOT NULL;

-- 2. Migrate old generation_musicongen rows to generation_chords
-- This handles the rename from MusiConGen to Chords
UPDATE credit_transactions 
SET type = 'generation_chords'
WHERE type = 'generation_musicongen';

-- Also update combined_media genre from musicongen to chords
UPDATE combined_media 
SET genre = 'chords'
WHERE genre = 'musicongen';

-- 3. Update credit_transactions type enum to include Chords
-- Note: PostgreSQL doesn't allow direct ALTER TYPE ADD, so we use this workaround
DO $$
BEGIN
  -- Add new type if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'generation_chords' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'credit_transaction_type')
  ) THEN
    -- If the enum type exists but doesn't have the value, we need to alter it
    BEGIN
      EXECUTE 'ALTER TYPE credit_transaction_type ADD VALUE IF NOT EXISTS ''generation_chords'';';
    EXCEPTION WHEN OTHERS THEN
      -- Fallback: recreate constraint if enum doesn't exist as type
      ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_type_check;
      ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_type_check CHECK (type IN (
        'generation_music',
        'generation_effects',
        'generation_loops',
        'generation_chords',
        'generation_image',
        'generation_video_to_audio',
        'generation_video',
        'generation_cover_art',
        'generation_stem_split',
        'generation_audio_boost',
        'generation_autotune',
        'generation_extract',
        'earn_list',
        'earn_purchase',
        'earn_sale',
        'earn_admin',
        'credit_award',
        'credit_refund',
        'wallet_deposit',
        'wallet_conversion',
        'subscription_bonus',
        'plugin_purchase',
        'quest_entry',
        'quest_reward',
        'release',
        'code_claim',
        'other'
      ));
    END;
  END IF;
END $$;

-- 4. Backfill chord progression from metadata for existing Chords generations
-- (if any were generated before this migration)
UPDATE combined_media
SET 
  chord_progression = metadata->>'text_chords',
  time_signature = COALESCE(metadata->>'time_sig', '4/4')
WHERE 
  genre = 'chords' 
  AND metadata IS NOT NULL 
  AND chord_progression IS NULL;

-- 5. Add index for BPM if not exists (helpful for filtering by tempo)
CREATE INDEX IF NOT EXISTS idx_combined_media_bpm ON combined_media(bpm) WHERE bpm IS NOT NULL;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Chords support added: chord_progression, time_signature columns created';
  RAISE NOTICE '✅ Credit transaction type generation_chords added';
  RAISE NOTICE '✅ Indexes created for performance';
END $$;
