-- Add generation_effects_hq type to credit_transactions CHECK constraint
-- This supports the HQ Text to SFX feature using fal.ai CassetteAI

-- Drop existing constraint
ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_type_check;

-- Re-create with generation_effects_hq included
ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_type_check
  CHECK (type IN (
    'generation_music',
    'generation_resound',
    'generation_effects',
    'generation_effects_hq',
    'generation_loops',
    'generation_chords',
    'generation_image',
    'generation_video_to_audio',
    'generation_video',
    'generation_lipsync',
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
