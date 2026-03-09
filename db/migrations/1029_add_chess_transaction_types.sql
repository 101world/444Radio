-- Migration 1029: Add chess game transaction types to credit_transactions CHECK constraint
--
-- Chess wager system: challenger and opponent both escrow credits. Winner gets the pool.
-- Without these types in the CHECK constraint, all chess credit transactions silently fail:
--   - deduct_credits logs fail silently (credits deducted but not logged)
--   - award_credits logs fail and RAISE EXCEPTION, rolling back the entire award
--     (so winners never receive credits and draw refunds never happen)

ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_type_check;

ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_type_check
  CHECK (type IN (
    -- AI Generation types
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
    -- Earn marketplace
    'earn_list',
    'earn_purchase',
    'earn_sale',
    'earn_admin',
    -- Credits & wallet
    'credit_award',
    'credit_refund',
    'wallet_deposit',
    'wallet_conversion',
    'subscription_bonus',
    'plugin_purchase',
    'code_claim',
    -- Quests
    'quest_entry',
    'quest_reward',
    -- Releases
    'release',
    -- Chess wagers
    'chess_wager',
    'chess_win',
    'chess_wager_refund',
    'chess_draw_refund',
    -- Catch-all
    'other'
  ));
