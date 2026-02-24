-- Migration 1022: Add generation_resound to credit_transactions type check
-- The Remix feature (MusicGen beat upload + prompt) uses this type for credit logging.
-- Without it, logCreditTransaction fails with "all retries exhausted".

DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'credit_transactions'
      AND constraint_type = 'CHECK'
      AND constraint_name = 'credit_transactions_type_check'
  ) THEN
    ALTER TABLE credit_transactions DROP CONSTRAINT credit_transactions_type_check;
  END IF;

  -- Re-create with generation_resound type included
  ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_type_check
    CHECK (type IN (
      'generation_music',
      'generation_effects',
      'generation_loops',
      'generation_chords',
      'generation_image',
      'generation_video_to_audio',
      'generation_cover_art',
      'generation_stem_split',
      'generation_audio_boost',
      'generation_autotune',
      'generation_video',
      'generation_lipsync',
      'generation_extract',
      'generation_resound',
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
      'code_claim',
      'quest_entry',
      'quest_reward',
      'release',
      'other'
    ));
END $$;
