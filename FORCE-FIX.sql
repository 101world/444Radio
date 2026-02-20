-- NUCLEAR OPTION: Force constraint update
-- Run this if the previous fix didn't work

BEGIN;

-- STEP 1: Update any invalid existing data FIRST
UPDATE credit_transactions SET type = 'generation_chords' WHERE type = 'generation_musicongen';
UPDATE credit_transactions SET type = 'generation_chords' WHERE type NOT IN (
    'generation_music','generation_effects','generation_loops','generation_chords',
    'generation_image','generation_video_to_audio','generation_video','generation_cover_art',
    'generation_stem_split','generation_audio_boost','generation_autotune','generation_extract',
    'earn_list','earn_purchase','earn_sale','earn_admin','credit_award','credit_refund',
    'wallet_deposit','wallet_conversion','subscription_bonus','plugin_purchase',
    'quest_entry','quest_reward','release','code_claim','other'
) AND type LIKE 'generation_%';

-- STEP 2: Remove ALL existing constraints on type column
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT conname FROM pg_constraint WHERE conrelid = 'credit_transactions'::regclass AND conname LIKE '%type%')
    LOOP
        EXECUTE 'ALTER TABLE credit_transactions DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- Add the new constraint with proper syntax
ALTER TABLE credit_transactions 
ADD CONSTRAINT credit_transactions_type_check 
CHECK (type IN (
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

-- Verify it worked
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'credit_transactions_type_check';

COMMIT;
