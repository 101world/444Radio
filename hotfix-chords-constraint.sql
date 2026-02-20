-- HOTFIX: Add generation_chords to credit_transactions constraint
-- Run this immediately on production database to enable Chords feature
-- This is the same as migration 129 but can be run independently

BEGIN;

-- Update any existing musicongen rows to chords
UPDATE credit_transactions 
SET type = 'generation_chords'
WHERE type = 'generation_musicongen';

UPDATE combined_media 
SET genre = 'chords'
WHERE genre = 'musicongen';

-- Drop and recreate constraint with generation_chords
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

-- Add columns if they don't exist
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS chord_progression TEXT;
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS time_signature TEXT DEFAULT '4/4';

COMMIT;

-- Verify the fix
SELECT 
  conname,
  pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'credit_transactions_type_check';
