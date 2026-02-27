-- ============================================================
-- Migration 1024: Quest Levels System + Lipsync Quests
-- ============================================================
-- Adds:
--   1. quest_level column to quests table (1-4)
--   2. quest_level_unlocks table for tracking user level progression
--   3. auto_renew column to quest_passes (default false)
--   4. New lipsync quest actions + 4-level quest structure
--   5. Adds generation_lipsync to credit_transactions type check
--
-- Level Structure:
--   Level 1: Starter quests (unlocked with quest pass)
--   Level 2: Unlocked after completing ALL Level 1 quests
--   Level 3: Unlocked after completing ALL Level 2 quests
--   Level 4: Ultimate tier (2000 credit max, music video challenge)
--
-- Economics: Rewards are always < 15% of what user spends completing them.
-- Date: 2026-02-27
-- ============================================================

-- 1. Add quest_level column to quests table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quests' AND column_name = 'quest_level'
  ) THEN
    ALTER TABLE quests ADD COLUMN quest_level INT NOT NULL DEFAULT 1;
    COMMENT ON COLUMN quests.quest_level IS 'Quest difficulty level (1-4). Users must complete all quests of a level to unlock the next.';
  END IF;
END $$;

-- 2. Add auto_renew column to quest_passes (default false = no auto-renew)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quest_passes' AND column_name = 'auto_renew'
  ) THEN
    ALTER TABLE quest_passes ADD COLUMN auto_renew BOOLEAN NOT NULL DEFAULT false;
    COMMENT ON COLUMN quest_passes.auto_renew IS 'Whether to auto-renew the quest pass. Default is false (manual renewal only).';
  END IF;
END $$;

-- 3. Create quest_level_unlocks table for tracking user level progression
CREATE TABLE IF NOT EXISTS quest_level_unlocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  level       INT NOT NULL DEFAULT 1,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, level)
);

CREATE INDEX IF NOT EXISTS idx_quest_level_unlocks_user ON quest_level_unlocks(user_id);

ALTER TABLE quest_level_unlocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own level unlocks" ON quest_level_unlocks;
CREATE POLICY "Users read own level unlocks"
  ON quest_level_unlocks FOR SELECT USING (true);

-- 4. Set existing quests to Level 1
UPDATE quests SET quest_level = 1 WHERE quest_level IS NULL OR quest_level = 0;

-- 5. Update credit_transactions type constraint to include generation_lipsync if missing
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'credit_transactions'
      AND constraint_type = 'CHECK'
      AND constraint_name = 'credit_transactions_type_check'
  ) THEN
    ALTER TABLE credit_transactions DROP CONSTRAINT credit_transactions_type_check;
  END IF;

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
END $$;

-- ============================================================
-- 6. INSERT LEVEL 2, 3, 4 QUESTS
-- ============================================================
-- 
-- ECONOMICS BREAKDOWN (all profitable):
-- 
-- Level 1 (existing): max ~600 credits reward, user spends 3000+ credits to complete all
-- Level 2: max ~800 credits reward, user spends 5000+ credits to complete all
-- Level 3: max ~1200 credits reward, user spends 10000+ credits to complete all  
-- Level 4: max ~2500 credits reward (2000 for music video), user spends 20000+ credits
--
-- Lipsync credit costs: 720p 5s=22cr, 1080p 5s=33cr, 1080p 10s=65cr
-- So "Generate 10 lipsync 1080p" = user spends 330+ credits, reward = 50 credits (15%)
-- "Release 5 lipsync 1080p" requires user to also generate them first = 165+ credits spent
-- ============================================================

-- ──────────────────── LEVEL 2 QUESTS ────────────────────
INSERT INTO quests (title, description, quest_type, requirement, credits_reward, is_active, quest_level)
SELECT * FROM (VALUES
  -- Monthly
  ('Song Factory',           'Generate 500 songs in a month',                         'monthly', '{"action": "generate_songs", "target": 500}'::jsonb,         200, true, 2),
  ('Video Visionary',        'Generate 10 lipsync videos',                            'monthly', '{"action": "generate_lipsync", "target": 10}'::jsonb,         50, true, 2),
  ('Mastering Pro',          'Use AI mastering (Boost Audio) 100 times',              'monthly', '{"action": "use_mastering", "target": 100}'::jsonb,          150, true, 2),
  ('Release Machine',        'Release 50 tracks publicly',                            'monthly', '{"action": "share_tracks", "target": 50}'::jsonb,            100, true, 2),
  ('Cover Art Factory',      'Generate 200 cover arts',                               'monthly', '{"action": "generate_cover_art", "target": 200}'::jsonb,     100, true, 2),
  ('Recruiter Commander',    'Invite 200 paying users',                               'monthly', '{"action": "invite_users", "target": 200}'::jsonb,           150, true, 2),
  -- Weekly
  ('Power Grinder',          'Generate 75 songs this week',                           'weekly',  '{"action": "generate_songs", "target": 75}'::jsonb,           40, true, 2),
  ('Lipsync Starter',        'Generate 3 lipsync videos this week',                   'weekly',  '{"action": "generate_lipsync", "target": 3}'::jsonb,          25, true, 2),
  ('Boost Weekly',           'Use AI mastering 15 times this week',                   'weekly',  '{"action": "use_mastering", "target": 15}'::jsonb,            30, true, 2),
  ('Weekly Publisher',       'Release 10 tracks publicly this week',                  'weekly',  '{"action": "share_tracks", "target": 10}'::jsonb,             30, true, 2),
  ('Streak Warrior',         'Generate and release daily for 7 days straight',        'weekly',  '{"action": "streak_lord", "target": 7}'::jsonb,               35, true, 2),
  ('Genre Master',           'Use 5 different genres this week',                      'weekly',  '{"action": "use_genres", "target": 5}'::jsonb,                30, true, 2)
) AS v(title, description, quest_type, requirement, credits_reward, is_active, quest_level)
WHERE NOT EXISTS (SELECT 1 FROM quests WHERE quest_level = 2 LIMIT 1);

-- ──────────────────── LEVEL 3 QUESTS ────────────────────
INSERT INTO quests (title, description, quest_type, requirement, credits_reward, is_active, quest_level)
SELECT * FROM (VALUES
  -- Monthly
  ('Song Empire',            'Generate 1000 songs in a month',                        'monthly', '{"action": "generate_songs", "target": 1000}'::jsonb,        400, true, 3),
  ('Lipsync Director',       'Generate 25 lipsync videos',                            'monthly', '{"action": "generate_lipsync", "target": 25}'::jsonb,        100, true, 3),
  ('HD Lipsync Master',      'Generate 10 lipsync videos at 1080p',                   'monthly', '{"action": "generate_lipsync_1080", "target": 10}'::jsonb,    80, true, 3),
  ('Release Lipsync HD',     'Release 5 lipsync 1080p videos publicly',               'monthly', '{"action": "release_lipsync_1080", "target": 5}'::jsonb,      60, true, 3),
  ('Mastering Legend',       'Use AI mastering (Boost Audio) 200 times',              'monthly', '{"action": "use_mastering", "target": 200}'::jsonb,          250, true, 3),
  ('Marketplace King',       'Upload 50 tracks to marketplace',                       'monthly', '{"action": "upload_marketplace", "target": 50}'::jsonb,      200, true, 3),
  ('Release Tsunami',        'Release 100 tracks publicly',                           'monthly', '{"action": "share_tracks", "target": 100}'::jsonb,           150, true, 3),
  ('Recruiter General',      'Invite 500 paying users',                               'monthly', '{"action": "invite_users", "target": 500}'::jsonb,           200, true, 3),
  -- Weekly
  ('Ultra Grinder',          'Generate 150 songs this week',                          'weekly',  '{"action": "generate_songs", "target": 150}'::jsonb,          80, true, 3),
  ('Lipsync Weekly Pro',     'Generate 5 lipsync videos this week',                   'weekly',  '{"action": "generate_lipsync", "target": 5}'::jsonb,          40, true, 3),
  ('Boost Master',           'Use AI mastering 30 times this week',                   'weekly',  '{"action": "use_mastering", "target": 30}'::jsonb,            50, true, 3),
  ('Publisher Elite',        'Release 25 tracks publicly this week',                  'weekly',  '{"action": "share_tracks", "target": 25}'::jsonb,             50, true, 3)
) AS v(title, description, quest_type, requirement, credits_reward, is_active, quest_level)
WHERE NOT EXISTS (SELECT 1 FROM quests WHERE quest_level = 3 LIMIT 1);

-- ──────────────────── LEVEL 4 QUESTS (ULTIMATE) ────────────────────
INSERT INTO quests (title, description, quest_type, requirement, credits_reward, is_active, quest_level)
SELECT * FROM (VALUES
  -- The Ultimate Quest: Music Video with 444 Radio tag
  ('444 Music Video',        'Create a full music video with 444 Radio and tag @444radio on release — 2000 credits', 'monthly', '{"action": "music_video_444tag", "target": 1}'::jsonb,  2000, true, 4),
  -- Monthly
  ('Song God',               'Generate 2000 songs in a month',                        'monthly', '{"action": "generate_songs", "target": 2000}'::jsonb,        600, true, 4),
  ('Lipsync Producer',       'Generate 50 lipsync videos',                            'monthly', '{"action": "generate_lipsync", "target": 50}'::jsonb,        200, true, 4),
  ('HD Lipsync Legend',      'Generate 25 lipsync videos at 1080p',                   'monthly', '{"action": "generate_lipsync_1080", "target": 25}'::jsonb,   150, true, 4),
  ('Release Lipsync Elite',  'Release 15 lipsync 1080p videos publicly',              'monthly', '{"action": "release_lipsync_1080", "target": 15}'::jsonb,    100, true, 4),
  ('Mastering God',          'Use AI mastering (Boost Audio) 500 times',              'monthly', '{"action": "use_mastering", "target": 500}'::jsonb,          400, true, 4),
  ('Marketplace Emperor',    'Upload 100 tracks to marketplace',                      'monthly', '{"action": "upload_marketplace", "target": 100}'::jsonb,     300, true, 4),
  ('Release Legend',         'Release 200 tracks publicly',                           'monthly', '{"action": "share_tracks", "target": 200}'::jsonb,           250, true, 4),
  ('Cover Art God',          'Generate 500 cover arts in a month',                    'monthly', '{"action": "generate_cover_art", "target": 500}'::jsonb,     200, true, 4),
  ('Recruiter God',          'Invite 1000 paying users this month',                   'monthly', '{"action": "invite_users", "target": 1000}'::jsonb,          300, true, 4),
  ('Ultimate Streak',        'Generate and release 1 track daily for 30 days straight','monthly', '{"action": "streak_lord", "target": 30}'::jsonb,            250, true, 4),
  -- Weekly
  ('Legendary Grinder',      'Generate 300 songs this week',                          'weekly',  '{"action": "generate_songs", "target": 300}'::jsonb,         150, true, 4),
  ('Lipsync Weekly Legend',  'Generate 10 lipsync videos this week',                  'weekly',  '{"action": "generate_lipsync", "target": 10}'::jsonb,         80, true, 4),
  ('Mastering Weekly God',   'Use AI mastering 50 times this week',                   'weekly',  '{"action": "use_mastering", "target": 50}'::jsonb,            80, true, 4),
  ('Publish Machine',        'Release 50 tracks publicly this week',                  'weekly',  '{"action": "share_tracks", "target": 50}'::jsonb,             80, true, 4)
) AS v(title, description, quest_type, requirement, credits_reward, is_active, quest_level)
WHERE NOT EXISTS (SELECT 1 FROM quests WHERE quest_level = 4 LIMIT 1);

-- ============================================================
-- 7. Create function to check if user has completed all quests for a level
-- ============================================================
CREATE OR REPLACE FUNCTION check_quest_level_completion(p_user_id TEXT, p_level INT)
RETURNS BOOLEAN AS $$
DECLARE
  total_quests INT;
  completed_quests INT;
BEGIN
  -- Count total active quests at this level
  SELECT COUNT(*) INTO total_quests
  FROM quests
  WHERE quest_level = p_level AND is_active = true;

  -- Count how many the user has completed (status = 'completed' or 'claimed')
  SELECT COUNT(DISTINCT uq.quest_id) INTO completed_quests
  FROM user_quests uq
  JOIN quests q ON q.id = uq.quest_id
  WHERE uq.user_id = p_user_id
    AND q.quest_level = p_level
    AND q.is_active = true
    AND uq.status IN ('completed', 'claimed');

  RETURN completed_quests >= total_quests AND total_quests > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8. Create function to get user's max unlocked level
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_quest_level(p_user_id TEXT)
RETURNS INT AS $$
DECLARE
  max_level INT := 1; -- Everyone starts at level 1
BEGIN
  -- Check each level progression
  IF check_quest_level_completion(p_user_id, 1) THEN
    max_level := 2;
    -- Auto-record unlock
    INSERT INTO quest_level_unlocks (user_id, level)
    VALUES (p_user_id, 2)
    ON CONFLICT (user_id, level) DO NOTHING;
  END IF;
  
  IF max_level >= 2 AND check_quest_level_completion(p_user_id, 2) THEN
    max_level := 3;
    INSERT INTO quest_level_unlocks (user_id, level)
    VALUES (p_user_id, 3)
    ON CONFLICT (user_id, level) DO NOTHING;
  END IF;
  
  IF max_level >= 3 AND check_quest_level_completion(p_user_id, 3) THEN
    max_level := 4;
    INSERT INTO quest_level_unlocks (user_id, level)
    VALUES (p_user_id, 4)
    ON CONFLICT (user_id, level) DO NOTHING;
  END IF;

  RETURN max_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
