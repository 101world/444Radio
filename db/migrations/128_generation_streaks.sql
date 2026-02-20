-- ============================================================
-- GENERATION STREAKS TRACKING
-- ============================================================
-- Tracks daily generation + release streaks for Streak Lord quest.
-- Automatically logs streak data each day a user generates + releases.
--
-- Date: 2026-02-20
-- ============================================================

-- 1. Generation streaks table
CREATE TABLE IF NOT EXISTS generation_streaks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  streak_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  generated     BOOLEAN NOT NULL DEFAULT false,
  released      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, streak_date)
);

CREATE INDEX IF NOT EXISTS idx_generation_streaks_user ON generation_streaks(user_id, streak_date DESC);

-- RLS
ALTER TABLE generation_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own streaks" ON generation_streaks;
CREATE POLICY "Users read own streaks"
  ON generation_streaks FOR SELECT USING (true);

-- 2. User models tracking (for "use all models" quest)
CREATE TABLE IF NOT EXISTS user_model_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  model_name    TEXT NOT NULL,
  first_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  use_count     INT NOT NULL DEFAULT 1,
  UNIQUE(user_id, model_name)
);

CREATE INDEX IF NOT EXISTS idx_user_model_usage_user ON user_model_usage(user_id);

-- RLS
ALTER TABLE user_model_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own model usage" ON user_model_usage;
CREATE POLICY "Users read own model usage"
  ON user_model_usage FOR SELECT USING (true);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to calculate current streak for a user
CREATE OR REPLACE FUNCTION get_user_streak(p_user_id TEXT)
RETURNS INT AS $$
DECLARE
  current_streak INT := 0;
  check_date DATE := CURRENT_DATE;
  has_activity BOOLEAN;
BEGIN
  LOOP
    SELECT (generated = true AND released = true)
    INTO has_activity
    FROM generation_streaks
    WHERE user_id = p_user_id AND streak_date = check_date;
    
    IF NOT FOUND OR NOT has_activity THEN
      EXIT;
    END IF;
    
    current_streak := current_streak + 1;
    check_date := check_date - INTERVAL '1 day';
  END LOOP;
  
  RETURN current_streak;
END;
$$ LANGUAGE plpgsql;
