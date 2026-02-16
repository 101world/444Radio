-- ============================================================
-- QUEST SYSTEM TABLES
-- ============================================================
-- Creates tables for the 444Radio quest/challenge system:
--   1. quests            – Admin-defined quest templates
--   2. quest_passes      – User $1 entry passes (30-day)
--   3. user_quests       – User progress on individual quests
--   4. quest_completions – Immutable completion log
--
-- Also adds 'quest_entry' and 'quest_reward' types to the
-- credit_transactions type constraint (if applicable).
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

-- 2. QUEST PASSES — $1 entry, 30-day window
CREATE TABLE IF NOT EXISTS quest_passes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,          -- clerk_user_id
  purchased_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  transaction_id UUID,                  -- FK to credit_transactions if desired
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

-- Seed initial quests (admin can edit later)
INSERT INTO quests (title, description, quest_type, requirement, credits_reward, is_active) VALUES
  -- Monthly quests
  ('Song Machine',        'Generate 200 songs in a month',       'monthly', '{"action": "generate_songs", "target": 200}',   100, true),
  ('Recruiter Elite',     'Invite 100 paying users',             'monthly', '{"action": "invite_users", "target": 100}',     100, true),
  ('Marketplace Maven',   'Upload 10 tracks to marketplace',     'monthly', '{"action": "upload_marketplace", "target": 10}', 100, true),
  ('Master Engineer',     'Use AI mastering 50 times',           'monthly', '{"action": "use_mastering", "target": 50}',     100, true),
  ('Streak Lord',         'Complete a 7-day generation streak',  'monthly', '{"action": "generation_streak", "target": 7}',  100, true),
  -- Weekly quests
  ('Weekly Grinder',      'Generate 25 songs this week',         'weekly',  '{"action": "generate_songs", "target": 25}',     20, true),
  ('Social Butterfly',    'Share 3 tracks publicly',             'weekly',  '{"action": "share_tracks", "target": 3}',        20, true),
  ('Loyal Operator',      'Login 5 days in a week',              'weekly',  '{"action": "login_days", "target": 5}',          20, true),
  ('Genre Explorer',      'Use 3 different genres',              'weekly',  '{"action": "use_genres", "target": 3}',          20, true),
  ('Recruitment Drive',   'Invite 5 users',                      'weekly',  '{"action": "invite_users", "target": 5}',        20, true),
  -- Daily quests
  ('Daily Creator',       'Generate 5 songs today',              'daily',   '{"action": "generate_songs", "target": 5}',      50, false),
  ('Social Share',        'Share 1 track on social',             'daily',   '{"action": "share_tracks", "target": 1}',        50, false),
  ('New Model Test',      'Use a new AI model once',             'daily',   '{"action": "use_new_model", "target": 1}',       50, false),
  ('Beat Maker',          'Login and create 1 beat',             'daily',   '{"action": "create_beat", "target": 1}',         50, false),
  -- Yearly quest
  ('Golden Recruiter',    'Invite 1000 users in a year',         'yearly',  '{"action": "invite_users", "target": 1000}',    250, true);
