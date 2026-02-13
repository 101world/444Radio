-- 1017: Enforce strictly one-time code redemptions
-- Codes are now lifetime one-time-use per user. No monthly reset.
-- Also adds 'code_claim' type to credit_transactions CHECK constraint.

-- Step 1: Add 'code_claim' to the credit_transactions type CHECK constraint
-- (We need to drop and re-add the constraint since Postgres can't ALTER CHECK)
DO $$
BEGIN
  -- Drop old check constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'credit_transactions'
      AND constraint_type = 'CHECK'
      AND constraint_name = 'credit_transactions_type_check'
  ) THEN
    ALTER TABLE credit_transactions DROP CONSTRAINT credit_transactions_type_check;
  END IF;

  -- Re-add with 'code_claim' included
  ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_type_check
    CHECK (type IN (
      'generation_music',
      'generation_effects',
      'generation_loops',
      'generation_image',
      'generation_video_to_audio',
      'generation_cover_art',
      'generation_stem_split',
      'earn_list',
      'earn_purchase',
      'earn_sale',
      'earn_admin',
      'credit_award',
      'credit_refund',
      'subscription_bonus',
      'code_claim',
      'other'
    ));
END $$;

-- Step 2: Add index on code_redemptions for fast lookups
CREATE INDEX IF NOT EXISTS idx_code_redemptions_user_code
  ON code_redemptions(clerk_user_id, code);
