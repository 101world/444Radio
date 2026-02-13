-- Add 'release' and 'generation_audio_boost' to credit_transactions type CHECK constraint
-- These types were missing, causing silent insert failures

DO $$
BEGIN
  -- Drop existing constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'credit_transactions'
      AND constraint_type = 'CHECK'
      AND constraint_name = 'credit_transactions_type_check'
  ) THEN
    ALTER TABLE credit_transactions DROP CONSTRAINT credit_transactions_type_check;
  END IF;

  -- Re-create with ALL types including release + generation_audio_boost
  ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_type_check
    CHECK (type IN (
      'generation_music',
      'generation_effects',
      'generation_loops',
      'generation_image',
      'generation_video_to_audio',
      'generation_cover_art',
      'generation_stem_split',
      'generation_audio_boost',
      'earn_list',
      'earn_purchase',
      'earn_sale',
      'earn_admin',
      'credit_award',
      'credit_refund',
      'subscription_bonus',
      'code_claim',
      'release',
      'other'
    ));
END $$;
