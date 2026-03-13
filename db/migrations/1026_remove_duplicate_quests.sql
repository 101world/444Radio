-- Remove duplicated quest rows
-- This migration removes any quests that have the same title, quest_type, quest_level, and requirement,
-- keeping only the earliest created row to avoid duplicates in the UI and quest tracking.

WITH duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY title, quest_type, quest_level, requirement
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM quests
)
DELETE FROM quests
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);
