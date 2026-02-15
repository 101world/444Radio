-- ============================================================================
-- 121: Add wallet_deposit + wallet_conversion to credit_transactions type CHECK
--
-- BUG FIX: Migration 119 introduced deposit_wallet() and
-- convert_wallet_to_credits() RPCs that log transactions with types
-- 'wallet_deposit' and 'wallet_conversion'. But these types were never
-- added to the credit_transactions_type_check constraint.
--
-- Impact: ALL audit-log INSERTs inside the RPCs failed silently
-- (EXCEPTION WHEN OTHERS → RAISE WARNING), which destroyed every
-- idempotency check. The verify route AND payment.captured webhook
-- both deposited + converted on the same payment — triple credit grant.
--
-- Also adds 'plugin_purchase' which is referenced in lib/credit-transactions.ts.
--
-- Date: 2026-02-16
-- ============================================================================

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

  -- Re-create with ALL types including wallet_deposit, wallet_conversion, plugin_purchase
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
      'code_claim',
      'release',
      'other'
    ));
END $$;
