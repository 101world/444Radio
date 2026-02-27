-- ============================================================
-- Migration 1025: Ensure exactly 15 quests per level (1–4)
-- ============================================================
-- Level 1 had 16 quests (from migration 126) — disable 1 daily to hit 15
-- Level 2 had 12 quests (from migration 1024) — add 3 more
-- Level 3 had 12 quests (from migration 1024) — add 3 more
-- Level 4 had 15 quests (from migration 1024) — already at 15, no changes
--
-- ECONOMICS (rewards always < 15% of user spend):
--   1 credit = $0.035
--   Lipsync: 720p 5s = 22cr, 1080p 5s = 33cr, 1080p 10s = 65cr
--   Songs: ~5cr each, Cover art: ~5cr, Mastering: ~3cr
--
-- Date: 2026-02-27
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- LEVEL 1: Currently 16 quests → trim to 15
-- Disable "Model Explorer" daily quest (use_all_models) which is already is_active=false
-- and slightly niche. That leaves exactly 15.
-- Actually, the 3 daily quests are already is_active=false from migration 126.
-- Only 13 are active (6 monthly + 6 weekly + 1 yearly).
-- So we need to ADD 2 more quests to Level 1 to reach 15 active quests,
-- OR activate the daily quests. Let's add 2 more and keep daily inactive.
-- Wait — let's count active only:
--   Monthly (6): Song Machine, Recruiter Elite, Marketplace Maven, Master Engineer, Streak Lord, Cover Art Maestro
--   Weekly (6): Weekly Grinder, Social Butterfly, Loyal Operator, Genre Explorer, Recruitment Drive, Beat Maker
--   Daily (3): Daily Creator (inactive), Social Share (inactive), Model Explorer (inactive)
--   Yearly (1): Golden Recruiter
-- Active total = 13. Need 2 more active. Let's add them.
-- ──────────────────────────────────────────────────────────────

-- L1: Add 2 new weekly quests to reach 15 active
INSERT INTO quests (title, description, quest_type, requirement, credits_reward, is_active, quest_level)
SELECT * FROM (VALUES
  ('Boost Beginner',        'Use AI mastering (Boost Audio) 5 times this week',       'weekly',  '{"action": "use_mastering", "target": 5}'::jsonb,       15, true, 1),
  ('Art Starter',           'Generate 10 cover arts this week',                       'weekly',  '{"action": "generate_cover_art", "target": 10}'::jsonb, 15, true, 1)
) AS v(title, description, quest_type, requirement, credits_reward, is_active, quest_level)
WHERE (SELECT COUNT(*) FROM quests WHERE quest_level = 1 AND is_active = true) < 15;


-- ──────────────────────────────────────────────────────────────
-- LEVEL 2: Currently 12 quests → add 3 more to reach 15
-- ──────────────────────────────────────────────────────────────
INSERT INTO quests (title, description, quest_type, requirement, credits_reward, is_active, quest_level)
SELECT * FROM (VALUES
  ('Lipsync HD Intro',      'Generate 3 lipsync videos at 1080p',                    'monthly', '{"action": "generate_lipsync_1080", "target": 3}'::jsonb,  40, true, 2),
  ('Art Commander',          'Generate 50 cover arts this month',                     'monthly', '{"action": "generate_cover_art", "target": 50}'::jsonb,   40, true, 2),
  ('Operator Streak',        'Generate and release daily for 14 days',               'monthly', '{"action": "streak_lord", "target": 14}'::jsonb,           50, true, 2)
) AS v(title, description, quest_type, requirement, credits_reward, is_active, quest_level)
WHERE (SELECT COUNT(*) FROM quests WHERE quest_level = 2 AND is_active = true) < 15;


-- ──────────────────────────────────────────────────────────────
-- LEVEL 3: Currently 12 quests → add 3 more to reach 15
-- ──────────────────────────────────────────────────────────────
INSERT INTO quests (title, description, quest_type, requirement, credits_reward, is_active, quest_level)
SELECT * FROM (VALUES
  ('Instrumental Architect', 'Create 50 instrumental tracks this month',              'monthly', '{"action": "create_instrumental", "target": 50}'::jsonb,  80, true, 3),
  ('Genre Commander',        'Use 8 different genres this week',                      'weekly',  '{"action": "use_genres", "target": 8}'::jsonb,            40, true, 3),
  ('Commander Streak',       'Generate and release daily for 21 days straight',       'monthly', '{"action": "streak_lord", "target": 21}'::jsonb,         100, true, 3)
) AS v(title, description, quest_type, requirement, credits_reward, is_active, quest_level)
WHERE (SELECT COUNT(*) FROM quests WHERE quest_level = 3 AND is_active = true) < 15;


-- ──────────────────────────────────────────────────────────────
-- VERIFICATION: Count quests per level (for logging)
-- ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  l1 INT; l2 INT; l3 INT; l4 INT;
BEGIN
  SELECT COUNT(*) INTO l1 FROM quests WHERE quest_level = 1 AND is_active = true;
  SELECT COUNT(*) INTO l2 FROM quests WHERE quest_level = 2 AND is_active = true;
  SELECT COUNT(*) INTO l3 FROM quests WHERE quest_level = 3 AND is_active = true;
  SELECT COUNT(*) INTO l4 FROM quests WHERE quest_level = 4 AND is_active = true;
  RAISE NOTICE 'Quest counts — L1: %, L2: %, L3: %, L4: %', l1, l2, l3, l4;
END $$;
