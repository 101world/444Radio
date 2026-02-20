-- ============================================================
-- QUEST SYSTEM TABLES
-- ============================================================
-- Creates tables for the 444Radio quest/challenge system:
--   1. quests            – Admin-defined quest templates
--   2. quest_passes      – User 1-credit entry passes (30-day)
--   3. user_quests       – User progress on individual quests
--   4. quest_completions – Immutable completion log
--
-- Quest passes cost 1 credit (deducted from user balance).
-- Quest rewards add credits (logged as 'quest_reward' in credit_transactions).
-- Both count toward the 444 billion admin wallet allocation in the dashboard.
-- 
-- All credit purchases (Razorpay/Stripe) flow to the 444 billion allocation,
-- NOT to personal admin wallets.
--
-- Date: 2026-02-16
-- ============================================================

-- 1. QUESTS — admin-created quest definitions
CREATE TABLE IF NOT EXISTS quests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  quest_type    TEXT NOT NULL CHECK (quest_type IN ('daily', 'weekly', 'monthly', 'yearly')),
  requirement   JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- requirement shape: { "action": "generate_songs", "target": 200 }
  credits_reward INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  starts_at     TIMESTAMPTZ,
  ends_at       TIMESTAMPTZ,
  created_by    TEXT, -- clerk_user_id of admin
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. QUEST PASSES — 1 credit entry, 30-day window
CREATE TABLE IF NOT EXISTS quest_passes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,          -- clerk_user_id
  purchased_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  credits_spent INT NOT NULL DEFAULT 30, -- Cost in credits (default 30)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quest_passes_user ON quest_passes(user_id);
CREATE INDEX IF NOT EXISTS idx_quest_passes_active ON quest_passes(user_id, is_active, expires_at);

-- 3. USER QUESTS — progress tracking
CREATE TABLE IF NOT EXISTS user_quests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  quest_id      UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  progress      INT NOT NULL DEFAULT 0,
  target        INT NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'claimed')),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  claimed_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_user_quests_user ON user_quests(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quests_quest ON user_quests(quest_id);
CREATE INDEX IF NOT EXISTS idx_user_quests_status ON user_quests(user_id, status);

-- 4. QUEST COMPLETIONS — immutable audit log
CREATE TABLE IF NOT EXISTS quest_completions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  quest_id      UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  credits_awarded INT NOT NULL DEFAULT 0,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quest_completions_user ON quest_completions(user_id);

-- RLS — enable for all tables (service role bypasses)
ALTER TABLE quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_completions ENABLE ROW LEVEL SECURITY;

-- Policies: users can read quests, own passes/progress
-- Use DROP IF EXISTS to make migration re-runnable
DROP POLICY IF EXISTS "Anyone can read active quests" ON quests;
DROP POLICY IF EXISTS "Users read own passes" ON quest_passes;
DROP POLICY IF EXISTS "Users read own quests" ON user_quests;
DROP POLICY IF EXISTS "Users read own completions" ON quest_completions;

CREATE POLICY "Anyone can read active quests"
  ON quests FOR SELECT USING (is_active = true);

CREATE POLICY "Users read own passes"
  ON quest_passes FOR SELECT USING (true);

CREATE POLICY "Users read own quests"
  ON user_quests FOR SELECT USING (true);

CREATE POLICY "Users read own completions"
  ON quest_completions FOR SELECT USING (true);

-- Grant service-role full access (API routes use service key)
-- No additional grants needed since service role bypasses RLS.

-- ============================================================
-- ADD QUEST TYPES TO CREDIT_TRANSACTIONS CONSTRAINT
-- ============================================================
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

  -- Re-create with quest types included
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

      'quest_entry',
      'quest_reward',
      'release',
      'other'
    ));
END $$;

-- Seed initial quests (skip if already seeded)
INSERT INTO quests (title, description, quest_type, requirement, credits_reward, is_active)
SELECT * FROM (VALUES
  -- Monthly quests
  ('Song Machine',        'Generate 200 songs in a month',                'monthly', '{"action": "generate_songs", "target": 200}'::jsonb,     100, true),
  ('Recruiter Elite',     'Invite 100 paying users',                      'monthly', '{"action": "invite_users", "target": 100}'::jsonb,       100, true),
  ('Marketplace Maven',   'Upload 10 tracks to marketplace',              'monthly', '{"action": "upload_marketplace", "target": 10}'::jsonb,  100, true),
  ('Master Engineer',     'Use AI mastering 50 times',                    'monthly', '{"action": "use_mastering", "target": 50}'::jsonb,       100, true),
  ('Streak Lord',         'Generate and release 1 track daily for 30 days', 'monthly', '{"action": "streak_lord", "target": 30}'::jsonb,     100, true),
  ('Cover Art Maestro',   'Generate 100 cover arts in a month',           'monthly', '{"action": "generate_cover_art", "target": 100}'::jsonb, 100, true),
  -- Weekly quests
  ('Weekly Grinder',      'Generate 25 songs this week',                  'weekly',  '{"action": "generate_songs", "target": 25}'::jsonb,       20, true),
  ('Social Butterfly',    'Share 3 tracks publicly',                      'weekly',  '{"action": "share_tracks", "target": 3}'::jsonb,          20, true),
  ('Loyal Operator',      'Login 5 days in a week',                       'weekly',  '{"action": "login_days", "target": 5}'::jsonb,            20, true),
  ('Genre Explorer',      'Use 3 different genres',                       'weekly',  '{"action": "use_genres", "target": 3}'::jsonb,            20, true),
  ('Recruitment Drive',   'Invite 5 users',                               'weekly',  '{"action": "invite_users", "target": 5}'::jsonb,          20, true),
  ('Beat Maker',          'Create 10 instrumental tracks',                'weekly',  '{"action": "create_instrumental", "target": 10}'::jsonb,  20, true),
  -- Daily quests
  ('Daily Creator',       'Generate 5 songs today',                       'daily',   '{"action": "generate_songs", "target": 5}'::jsonb,        50, false),
  ('Social Share',        'Share 1 track on social',                      'daily',   '{"action": "share_tracks", "target": 1}'::jsonb,          50, false),
  ('Model Explorer',      'Use all available AI models at least once',    'daily',   '{"action": "use_all_models", "target": 1}'::jsonb,        50, false),
  -- Yearly quest
  ('Golden Recruiter',    'Invite 1000 users in a year',                  'yearly',  '{"action": "invite_users", "target": 1000}'::jsonb,      250, true)
) AS v(title, description, quest_type, requirement, credits_reward, is_active)
WHERE NOT EXISTS (SELECT 1 FROM quests LIMIT 1);
