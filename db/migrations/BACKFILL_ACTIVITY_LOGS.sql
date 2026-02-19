-- =====================================================
-- BACKFILL HISTORICAL ACTIVITY DATA
-- Populates activity_logs with existing data from other tables
-- Run this ONCE after migrations to get historical data
-- =====================================================

-- 1. Backfill PLAY actions from combined_media plays
-- We don't have individual play records, so we'll create summary entries
INSERT INTO activity_logs (user_id, action_type, resource_type, resource_id, metadata, created_at)
SELECT 
  user_id,
  'play' as action_type,
  'media' as resource_type,
  id as resource_id,
  jsonb_build_object('title', title, 'plays', plays, 'is_backfill', true) as metadata,
  created_at
FROM combined_media
WHERE plays > 0 AND user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 2. Backfill LIKE actions from user_likes
INSERT INTO activity_logs (user_id, action_type, resource_type, resource_id, metadata, created_at)
SELECT 
  user_id,
  'like' as action_type,
  'media' as resource_type,
  release_id as resource_id,
  jsonb_build_object('is_backfill', true) as metadata,
  created_at
FROM user_likes
WHERE user_id IS NOT NULL
  AND release_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Backfill FOLLOW actions from followers
INSERT INTO activity_logs (user_id, action_type, resource_type, resource_id, metadata, created_at)
SELECT 
  follower_id as user_id,
  'follow' as action_type,
  'user' as resource_type,
  following_id as resource_id,
  jsonb_build_object('is_backfill', true) as metadata,
  created_at
FROM followers
WHERE follower_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 4. Backfill UPLOAD/RELEASE actions from combined_media
INSERT INTO activity_logs (user_id, action_type, resource_type, resource_id, metadata, created_at)
SELECT 
  user_id,
  'release' as action_type,
  'media' as resource_type,
  id as resource_id,
  jsonb_build_object(
    'title', title,
    'type', type,
    'is_public', is_public,
    'is_backfill', true
  ) as metadata,
  created_at
FROM combined_media
WHERE user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 5. Backfill GENERATION actions from plugin_jobs (completed only)
INSERT INTO activity_logs (user_id, action_type, resource_type, resource_id, metadata, created_at)
SELECT 
  clerk_user_id as user_id,
  'generate_music' as action_type,
  'media' as resource_type,
  id as resource_id,
  jsonb_build_object(
    'plugin_type', type,
    'status', status,
    'credits_cost', credits_cost,
    'is_backfill', true
  ) as metadata,
  created_at
FROM plugin_jobs
WHERE clerk_user_id IS NOT NULL 
  AND status = 'completed'
  AND type IS NOT NULL
ON CONFLICT DO NOTHING;

-- 6. Backfill SIGNUP actions from users table
INSERT INTO activity_logs (user_id, action_type, resource_type, resource_id, metadata, created_at)
SELECT 
  clerk_user_id as user_id,
  'signup' as action_type,
  'user' as resource_type,
  clerk_user_id as resource_id,
  jsonb_build_object(
    'username', username,
    'email', email,
    'is_backfill', true
  ) as metadata,
  created_at
FROM users
WHERE clerk_user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 7. Backfill CREDIT actions from credit_transactions
INSERT INTO activity_logs (user_id, action_type, resource_type, resource_id, metadata, created_at)
SELECT 
  user_id,
  CASE 
    WHEN type = 'wallet_deposit' THEN 'credit_deposit'
    WHEN type = 'code_claim' THEN 'code_redeem'
    WHEN type = 'credit_award' THEN 'credit_award'
    WHEN type = 'credit_refund' THEN 'credit_refund'
    ELSE 'credit_transaction'
  END as action_type,
  'credit' as resource_type,
  id::text as resource_id,
  jsonb_build_object(
    'amount', amount,
    'type', type,
    'description', description,
    'is_backfill', true
  ) as metadata,
  created_at
FROM credit_transactions
WHERE user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check total backfilled records by action type
SELECT 
  action_type,
  COUNT(*) as count,
  MIN(created_at) as earliest,
  MAX(created_at) as latest
FROM activity_logs
WHERE (metadata->>'is_backfill')::boolean = true
GROUP BY action_type
ORDER BY count DESC;

-- Check total activity logs
SELECT COUNT(*) as total_logs FROM activity_logs;

-- Check date range
SELECT 
  MIN(created_at) as first_activity,
  MAX(created_at) as last_activity,
  COUNT(DISTINCT user_id) as unique_users
FROM activity_logs;

-- Top 10 users by activity count
SELECT 
  user_id,
  COUNT(*) as activity_count
FROM activity_logs
GROUP BY user_id
ORDER BY activity_count DESC
LIMIT 10;

COMMENT ON TABLE activity_logs IS 'Activity logs with historical backfill completed';
