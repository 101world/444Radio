-- Backfill credit_transactions from existing combined_media + earn_transactions
-- Run this once in Supabase SQL editor to populate wallet history

-- 1. Backfill generation transactions from combined_media
INSERT INTO credit_transactions (user_id, amount, balance_after, type, status, description, metadata, created_at)
SELECT
  cm.user_id,
  CASE
    WHEN cm.type = 'image' THEN -1
    ELSE -2
  END AS amount,
  NULL AS balance_after,  -- unknown for historical records
  CASE cm.type
    WHEN 'audio' THEN 'generation_music'
    WHEN 'image' THEN 'generation_image'
    WHEN 'video' THEN 'generation_video_to_audio'
    ELSE 'generation_music'
  END AS type,
  'success' AS status,
  COALESCE(
    CASE cm.type
      WHEN 'audio' THEN 'Music: ' || LEFT(COALESCE(cm.title, cm.prompt, 'Untitled'), 60)
      WHEN 'image' THEN 'Image: ' || LEFT(COALESCE(cm.title, cm.prompt, 'Untitled'), 60)
      WHEN 'video' THEN 'Video SFX: ' || LEFT(COALESCE(cm.title, cm.prompt, 'Untitled'), 60)
      ELSE 'Generation: ' || LEFT(COALESCE(cm.title, cm.prompt, 'Untitled'), 60)
    END
  ) AS description,
  jsonb_build_object('backfilled', true, 'source', 'combined_media', 'media_id', cm.id::text) AS metadata,
  cm.created_at
FROM combined_media cm
WHERE cm.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM credit_transactions ct
    WHERE ct.user_id = cm.user_id
      AND ct.created_at = cm.created_at
      AND ct.metadata->>'media_id' = cm.id::text
  )
ORDER BY cm.created_at;

-- 2. Backfill earn purchase/sale transactions (if earn_transactions table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'earn_transactions') THEN
    -- Buyer side (purchase)
    INSERT INTO credit_transactions (user_id, amount, balance_after, type, status, description, metadata, created_at)
    SELECT
      et.buyer_id,
      -et.total_cost,
      NULL,
      'earn_purchase',
      'success',
      'Purchased track from Earn marketplace',
      jsonb_build_object('backfilled', true, 'source', 'earn_transactions', 'track_id', et.track_id::text),
      et.created_at
    FROM earn_transactions et
    WHERE et.buyer_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM credit_transactions ct
        WHERE ct.user_id = et.buyer_id
          AND ct.type = 'earn_purchase'
          AND ct.metadata->>'track_id' = et.track_id::text
      );

    -- Seller side (sale revenue)
    INSERT INTO credit_transactions (user_id, amount, balance_after, type, status, description, metadata, created_at)
    SELECT
      et.seller_id,
      et.artist_share,
      NULL,
      'earn_sale',
      'success',
      'Earned from track sale on Earn marketplace',
      jsonb_build_object('backfilled', true, 'source', 'earn_transactions', 'track_id', et.track_id::text),
      et.created_at
    FROM earn_transactions et
    WHERE et.seller_id IS NOT NULL
      AND et.artist_share > 0
      AND NOT EXISTS (
        SELECT 1 FROM credit_transactions ct
        WHERE ct.user_id = et.seller_id
          AND ct.type = 'earn_sale'
          AND ct.metadata->>'track_id' = et.track_id::text
      );

    -- Admin side (platform fees)
    INSERT INTO credit_transactions (user_id, amount, balance_after, type, status, description, metadata, created_at)
    SELECT
      et.admin_id,
      et.admin_share,
      NULL,
      'earn_admin',
      'success',
      'Platform fee from Earn transaction',
      jsonb_build_object('backfilled', true, 'source', 'earn_transactions', 'track_id', et.track_id::text),
      et.created_at
    FROM earn_transactions et
    WHERE et.admin_id IS NOT NULL
      AND et.admin_share > 0
      AND NOT EXISTS (
        SELECT 1 FROM credit_transactions ct
        WHERE ct.user_id = et.admin_id
          AND ct.type = 'earn_admin'
          AND ct.metadata->>'track_id' = et.track_id::text
      );
  END IF;
END $$;

-- 3. Backfill music_library items that aren't in combined_media (older generations)
INSERT INTO credit_transactions (user_id, amount, balance_after, type, status, description, metadata, created_at)
SELECT
  ml.clerk_user_id,
  -2,
  NULL,
  'generation_music',
  'success',
  'Music: ' || LEFT(COALESCE(ml.title, ml.prompt, 'Untitled'), 60),
  jsonb_build_object('backfilled', true, 'source', 'music_library', 'library_id', ml.id::text),
  ml.created_at
FROM music_library ml
WHERE ml.clerk_user_id IS NOT NULL
  AND ml.status = 'ready'
  AND NOT EXISTS (
    SELECT 1 FROM credit_transactions ct
    WHERE ct.user_id = ml.clerk_user_id
      AND ct.created_at = ml.created_at
      AND ct.metadata->>'library_id' = ml.id::text
  )
  -- Skip items already covered by combined_media backfill (approximate match)
  AND NOT EXISTS (
    SELECT 1 FROM credit_transactions ct
    WHERE ct.user_id = ml.clerk_user_id
      AND ct.type = 'generation_music'
      AND ct.created_at = ml.created_at
  )
ORDER BY ml.created_at;
