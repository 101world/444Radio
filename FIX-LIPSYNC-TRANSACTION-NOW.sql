-- URGENT FIX: Add generation_lipsync to credit_transactions type check
-- Run this in Supabase SQL Editor NOW to fix lip-sync generation

-- Drop existing constraint
ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_type_check;

-- Re-create with generation_lipsync included
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

-- Verify the constraint was added
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'credit_transactions_type_check';
