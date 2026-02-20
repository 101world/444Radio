-- RUN THIS FIRST: Check if generation_chords is in the constraint
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'credit_transactions_type_check';

-- If generation_chords is NOT in the result above, run this fix:
-- (Copy lines below and run separately)

ALTER TABLE credit_transactions DROP CONSTRAINT credit_transactions_type_check;
ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_type_check CHECK (type::text = ANY (ARRAY[
  'generation_music'::text,
  'generation_effects'::text,
  'generation_loops'::text,
  'generation_chords'::text,
  'generation_image'::text,
  'generation_video_to_audio'::text,
  'generation_video'::text,
  'generation_cover_art'::text,
  'generation_stem_split'::text,
  'generation_audio_boost'::text,
  'generation_autotune'::text,
  'generation_extract'::text,
  'earn_list'::text,
  'earn_purchase'::text,
  'earn_sale'::text,
  'earn_admin'::text,
  'credit_award'::text,
  'credit_refund'::text,
  'wallet_deposit'::text,
  'wallet_conversion'::text,
  'subscription_bonus'::text,
  'plugin_purchase'::text,
  'quest_entry'::text,
  'quest_reward'::text,
  'release'::text,
  'code_claim'::text,
  'other'::text
]));
