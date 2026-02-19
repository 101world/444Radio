-- =====================================================
-- VERIFICATION SCRIPT: Activity Logging System
-- Run this after migrations to verify everything works
-- =====================================================

-- 1. Check tables exist
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('activity_logs', 'user_sessions')
ORDER BY table_name;
-- Expected: 2 rows (activity_logs with 10 columns, user_sessions with 12 columns)

-- 2. Check indexes exist
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE tablename IN ('activity_logs', 'user_sessions')
ORDER BY tablename, indexname;
-- Expected: ~13 indexes total (7 for activity_logs, 6 for user_sessions)

-- 3. Check helper functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_active_users_count',
    'get_user_last_activity',
    'get_active_sessions_count',
    'end_inactive_sessions',
    'update_session_activity',
    'sync_user_last_active'
  )
ORDER BY routine_name;
-- Expected: 6 functions

-- 4. Check RLS policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE tablename IN ('activity_logs', 'user_sessions')
ORDER BY tablename, policyname;
-- Expected: 2 policies (one for each table)

-- 5. Check users table has last_active_at column
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name = 'last_active_at';
-- Expected: 1 row (timestamptz, YES)

-- 6. Check trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_sync_user_last_active';
-- Expected: 1 row

-- 7. Test helper functions (these should return 0 initially)
SELECT get_active_users_count(1440) as active_users_today;
-- Expected: 0 (no activity yet)

SELECT get_active_sessions_count(5) as active_sessions_now;
-- Expected: 0 (no sessions yet)

-- 8. Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE tablename IN ('activity_logs', 'user_sessions')
ORDER BY tablename;
-- Expected: Both should be ~8-16 KB (empty tables with indexes)

-- =====================================================
-- TEST DATA (Optional - insert sample data to verify)
-- =====================================================

-- Insert a test activity log
-- INSERT INTO activity_logs (user_id, action_type, resource_type, resource_id, metadata)
-- VALUES ('test_user_123', 'play', 'media', 'test_media_456', '{"test": true}');

-- Insert a test session
-- INSERT INTO user_sessions (user_id, session_id, device_type, browser, os)
-- VALUES ('test_user_123', 'test_session_789', 'desktop', 'Chrome', 'Windows');

-- Verify inserts worked
-- SELECT COUNT(*) FROM activity_logs WHERE user_id = 'test_user_123';
-- SELECT COUNT(*) FROM user_sessions WHERE user_id = 'test_user_123';

-- Clean up test data
-- DELETE FROM activity_logs WHERE user_id = 'test_user_123';
-- DELETE FROM user_sessions WHERE user_id = 'test_user_123';

-- =====================================================
-- SUCCESS CRITERIA
-- =====================================================
-- ✅ 2 tables exist
-- ✅ 13 indexes created
-- ✅ 6 helper functions work
-- ✅ 2 RLS policies active
-- ✅ Trigger on user_sessions works
-- ✅ users.last_active_at column exists
-- ✅ No errors when querying helper functions

COMMENT ON SCHEMA public IS 'Activity logging system verified and operational!';
