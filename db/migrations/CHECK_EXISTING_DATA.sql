-- =====================================================
-- CHECK EXISTING DATA FOR ADMIN DASHBOARD
-- Run this to see what data exists for analytics
-- =====================================================

-- 1. Check Users
SELECT 
  'USERS' as table_name,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7d,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last_30d
FROM users;

-- 2. Check Combined Media (all content)
SELECT 
  'COMBINED_MEDIA' as table_name,
  COUNT(*) as total_count,
  SUM(plays) as total_plays,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7d,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last_30d
FROM combined_media;

-- 3. Check Likes
SELECT 
  'USER_LIKES' as table_name,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE liked_at > NOW() - INTERVAL '24 hours') as last_24h,
  COUNT(*) FILTER (WHERE liked_at > NOW() - INTERVAL '7 days') as last_7d,
  COUNT(*) FILTER (WHERE liked_at > NOW() - INTERVAL '30 days') as last_30d
FROM user_likes;

-- 4. Check Follows
SELECT 
  'USER_FOLLOWS' as table_name,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE followed_at > NOW() - INTERVAL '24 hours') as last_24h,
  COUNT(*) FILTER (WHERE followed_at > NOW() - INTERVAL '7 days') as last_7d,
  COUNT(*) FILTER (WHERE followed_at > NOW() - INTERVAL '30 days') as last_30d
FROM user_follows;

-- 5. Check Plugin Jobs (generations)
SELECT 
  'PLUGIN_JOBS' as table_name,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7d,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last_30d
FROM plugin_jobs;

-- 6. Check Credit Transactions
SELECT 
  'CREDIT_TRANSACTIONS' as table_name,
  COUNT(*) as total_count,
  SUM(credits) as total_credits,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7d,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last_30d
FROM credit_transactions;

-- 7. Check Activity Logs (if backfilled)
SELECT 
  'ACTIVITY_LOGS' as table_name,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7d,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last_30d
FROM activity_logs;

-- 8. Check User Sessions
SELECT 
  'USER_SESSIONS' as table_name,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE ended_at IS NULL) as active_sessions,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7d,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last_30d
FROM user_sessions;

-- =====================================================
-- DETAILED BREAKDOWNS
-- =====================================================

-- Plugin Jobs by Model
SELECT 
  plugin_name,
  COUNT(*) as runs,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM plugin_jobs
GROUP BY plugin_name
ORDER BY runs DESC;

-- Combined Media by Type
SELECT 
  type,
  COUNT(*) as count,
  SUM(plays) as total_plays,
  AVG(plays) as avg_plays
FROM combined_media
GROUP BY type
ORDER BY count DESC;

-- Top 10 Most Played Tracks
SELECT 
  id,
  title,
  user_id,
  plays,
  created_at
FROM combined_media
WHERE plays > 0
ORDER BY plays DESC
LIMIT 10;

-- Recent Activity (if backfilled)
SELECT 
  action_type,
  COUNT(*) as count
FROM activity_logs
GROUP BY action_type
ORDER BY count DESC;

-- User Engagement Summary
SELECT 
  COUNT(DISTINCT u.clerk_user_id) as total_users,
  COUNT(DISTINCT cm.user_id) as users_with_content,
  COUNT(DISTINCT ul.user_id) as users_who_liked,
  COUNT(DISTINCT uf.follower_id) as users_who_followed,
  COUNT(DISTINCT pj.user_id) as users_who_generated
FROM users u
LEFT JOIN combined_media cm ON u.clerk_user_id = cm.user_id
LEFT JOIN user_likes ul ON u.clerk_user_id = ul.user_id
LEFT JOIN user_follows uf ON u.clerk_user_id = uf.follower_id
LEFT JOIN plugin_jobs pj ON u.clerk_user_id = pj.user_id;
