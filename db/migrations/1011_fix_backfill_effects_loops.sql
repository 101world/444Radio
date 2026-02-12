-- Fix backfilled transactions: re-tag effects and loops based on combined_media genre
-- Effects: genre='effects' or title starts with 'SFX:'
-- Loops: genre='loop' or title starts with 'Loop:'

-- Update effects transactions
UPDATE credit_transactions ct
SET type = 'generation_effects',
    description = 'Effects: ' || COALESCE(
      (SELECT cm.title FROM combined_media cm WHERE cm.id::text = ct.metadata->>'media_id'),
      ct.description
    )
FROM combined_media cm
WHERE ct.metadata->>'media_id' = cm.id::text
  AND ct.type = 'generation_music'
  AND (cm.genre = 'effects' OR cm.title ILIKE 'SFX:%');

-- Update loops transactions
UPDATE credit_transactions ct
SET type = 'generation_loops',
    description = 'Loops: ' || COALESCE(
      (SELECT cm2.title FROM combined_media cm2 WHERE cm2.id::text = ct.metadata->>'media_id'),
      ct.description
    )
FROM combined_media cm
WHERE ct.metadata->>'media_id' = cm.id::text
  AND ct.type = 'generation_music'
  AND (cm.genre = 'loop' OR cm.title ILIKE 'Loop:%');

-- Also update any with image_url that look like cover art (not music)
-- combined_media with type='image' should be generation_image
UPDATE credit_transactions ct
SET type = 'generation_image'
FROM combined_media cm
WHERE ct.metadata->>'media_id' = cm.id::text
  AND ct.type = 'generation_music'
  AND cm.type = 'image';
