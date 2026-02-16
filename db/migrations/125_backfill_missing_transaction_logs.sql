-- ============================================================
-- BACKFILL MISSING TRANSACTION LOGS
-- ============================================================
-- This script finds all generations in combined_media that are
-- missing corresponding credit_transactions records and creates
-- backfill INSERT statements for them.
--
-- Run this in Supabase SQL Editor.
-- ============================================================

-- Step 1: Check what's missing (DRY RUN)
-- Shows generations without matching transactions

SELECT 
  cm.id,
  cm.user_id,
  cm.title,
  cm.genre,
  cm.type,
  cm.created_at,
  CASE 
    WHEN cm.genre = 'stem' THEN 'generation_stem_split'
    WHEN cm.genre = 'boosted' THEN 'generation_audio_boost'
    WHEN cm.genre = 'extract' THEN 'generation_extract'
    WHEN cm.genre = 'processed' THEN 'generation_autotune'
    WHEN cm.genre = 'loop' THEN 'generation_loops'
    WHEN cm.genre = 'effects' THEN 'generation_effects'
    WHEN cm.type = 'image' THEN 'generation_image'
    WHEN cm.type = 'video' THEN 'generation_video_to_audio'
    ELSE 'generation_music'
  END AS inferred_type,
  CASE 
    WHEN cm.genre = 'stem' THEN 5
    WHEN cm.genre = 'boosted' THEN 1
    WHEN cm.genre = 'extract' THEN 1
    WHEN cm.genre = 'processed' THEN 1
    WHEN cm.genre = 'loop' THEN 2
    WHEN cm.genre = 'effects' THEN 2
    WHEN cm.type = 'image' THEN 1
    WHEN cm.type = 'video' THEN 2
    ELSE 5
  END AS inferred_credits
FROM combined_media cm
LEFT JOIN credit_transactions ct 
  ON ct.user_id = cm.user_id 
  AND ct.created_at BETWEEN cm.created_at - INTERVAL '5 minutes' AND cm.created_at + INTERVAL '5 minutes'
  AND ct.type LIKE 'generation_%'
WHERE ct.id IS NULL
  AND cm.user_id IS NOT NULL
ORDER BY cm.created_at DESC;


-- Step 2: Count missing by type
SELECT 
  CASE 
    WHEN cm.genre = 'stem' THEN 'generation_stem_split'
    WHEN cm.genre = 'boosted' THEN 'generation_audio_boost'
    WHEN cm.genre = 'extract' THEN 'generation_extract'
    WHEN cm.genre = 'processed' THEN 'generation_autotune'
    WHEN cm.genre = 'loop' THEN 'generation_loops'
    WHEN cm.genre = 'effects' THEN 'generation_effects'
    WHEN cm.type = 'image' THEN 'generation_image'
    WHEN cm.type = 'video' THEN 'generation_video_to_audio'
    ELSE 'generation_music'
  END AS missing_type,
  COUNT(*) AS count,
  SUM(CASE 
    WHEN cm.genre = 'stem' THEN 5
    WHEN cm.genre = 'boosted' THEN 1
    WHEN cm.genre = 'extract' THEN 1
    WHEN cm.genre = 'processed' THEN 1
    WHEN cm.genre = 'loop' THEN 2
    WHEN cm.genre = 'effects' THEN 2
    WHEN cm.type = 'image' THEN 1
    WHEN cm.type = 'video' THEN 2
    ELSE 5
  END) AS total_credits
FROM combined_media cm
LEFT JOIN credit_transactions ct 
  ON ct.user_id = cm.user_id 
  AND ct.created_at BETWEEN cm.created_at - INTERVAL '5 minutes' AND cm.created_at + INTERVAL '5 minutes'
  AND ct.type LIKE 'generation_%'
WHERE ct.id IS NULL
  AND cm.user_id IS NOT NULL
GROUP BY missing_type
ORDER BY count DESC;


-- Step 3: BACKFILL — Insert missing transaction logs
-- 29 missing records found: 15 stem_split (75cr), 6 extract (6cr), 5 music (25cr), 2 audio_boost (2cr), 1 video_to_audio (2cr) = 110 credits total

INSERT INTO credit_transactions (user_id, type, credits_amount, description, metadata, created_at)
SELECT 
  cm.user_id,
  CASE 
    WHEN cm.genre = 'stem' THEN 'generation_stem_split'
    WHEN cm.genre = 'boosted' THEN 'generation_audio_boost'
    WHEN cm.genre = 'extract' THEN 'generation_extract'
    WHEN cm.genre = 'processed' THEN 'generation_autotune'
    WHEN cm.genre = 'loop' THEN 'generation_loops'
    WHEN cm.genre = 'effects' THEN 'generation_effects'
    WHEN cm.type = 'image' THEN 'generation_image'
    WHEN cm.type = 'video' THEN 'generation_video_to_audio'
    ELSE 'generation_music'
  END AS type,
  -(CASE 
    WHEN cm.genre = 'stem' THEN 5
    WHEN cm.genre = 'boosted' THEN 1
    WHEN cm.genre = 'extract' THEN 1
    WHEN cm.genre = 'processed' THEN 1
    WHEN cm.genre = 'loop' THEN 2
    WHEN cm.genre = 'effects' THEN 2
    WHEN cm.type = 'image' THEN 1
    WHEN cm.type = 'video' THEN 2
    ELSE 5
  END) AS credits_amount,
  CONCAT('[BACKFILL] ', 
    CASE 
      WHEN cm.genre = 'stem' THEN 'Stem split'
      WHEN cm.genre = 'boosted' THEN 'Audio boost'
      WHEN cm.genre = 'extract' THEN 'Audio extract'
      WHEN cm.genre = 'processed' THEN 'Autotune'
      WHEN cm.genre = 'loop' THEN 'Loop generation'
      WHEN cm.genre = 'effects' THEN 'Effects generation'
      WHEN cm.type = 'image' THEN 'Image generation'
      WHEN cm.type = 'video' THEN 'Video to audio'
      ELSE 'Music generation'
    END,
    ': ', COALESCE(cm.title, 'Untitled')
  ) AS description,
  jsonb_build_object(
    'backfill', true,
    'backfill_date', NOW(),
    'media_id', cm.id,
    'title', COALESCE(cm.title, 'Untitled'),
    'genre', cm.genre,
    'media_type', cm.type
  ) AS metadata,
  cm.created_at
FROM combined_media cm
LEFT JOIN credit_transactions ct 
  ON ct.user_id = cm.user_id 
  AND ct.created_at BETWEEN cm.created_at - INTERVAL '5 minutes' AND cm.created_at + INTERVAL '5 minutes'
  AND ct.type LIKE 'generation_%'
WHERE ct.id IS NULL
  AND cm.user_id IS NOT NULL;


-- Step 4: Verify after backfill
-- Run after Step 3 to confirm all gaps are filled

SELECT 
  'After backfill' AS status,
  (SELECT COUNT(*) FROM combined_media WHERE user_id IS NOT NULL) AS total_media,
  (SELECT COUNT(*) FROM credit_transactions WHERE type LIKE 'generation_%') AS total_gen_transactions;
