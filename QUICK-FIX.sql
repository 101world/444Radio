-- COPY THIS ENTIRE FILE AND RUN IN SUPABASE SQL EDITOR
-- This takes 2 seconds to fix the Chords feature

-- Step 1: Update old data
UPDATE credit_transactions SET type = 'generation_chords' WHERE type = 'generation_musicongen';
UPDATE combined_media SET genre = 'chords' WHERE genre = 'musicongen';

-- Step 2: Fix the constraint
ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_type_check;
ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_type_check CHECK (type IN ('generation_music','generation_effects','generation_loops','generation_chords','generation_image','generation_video_to_audio','generation_video','generation_cover_art','generation_stem_split','generation_audio_boost','generation_autotune','generation_extract','earn_list','earn_purchase','earn_sale','earn_admin','credit_award','credit_refund','wallet_deposit','wallet_conversion','subscription_bonus','plugin_purchase','quest_entry','quest_reward','release','code_claim','other'));

-- Step 3: Add missing columns
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS chord_progression TEXT;
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS time_signature TEXT DEFAULT '4/4';

-- DONE! Chords will work immediately after running this.
