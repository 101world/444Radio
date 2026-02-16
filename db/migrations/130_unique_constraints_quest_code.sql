-- Migration 130: Add unique constraint on quest_completions to prevent double-claims
-- This is the belt-and-suspenders for the code-level fix in quest claim route.

-- quest_completions: one completion per (user_id, quest_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_unique_quest_completion'
  ) THEN
    -- Delete any existing duplicates first (keep earliest)
    DELETE FROM quest_completions
    WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY user_id, quest_id ORDER BY completed_at ASC
        ) as rn
        FROM quest_completions
      ) dupes
      WHERE rn > 1
    );

    CREATE UNIQUE INDEX idx_unique_quest_completion
    ON quest_completions (user_id, quest_id);
  END IF;
END $$;

-- code_redemptions: one claim per (clerk_user_id, code) — may already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_unique_code_redemption'
  ) THEN
    -- Delete any existing duplicates first (keep earliest)
    DELETE FROM code_redemptions
    WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY clerk_user_id, code ORDER BY redeemed_at ASC
        ) as rn
        FROM code_redemptions
      ) dupes
      WHERE rn > 1
    );

    CREATE UNIQUE INDEX idx_unique_code_redemption
    ON code_redemptions (clerk_user_id, code);
  END IF;
END $$;
