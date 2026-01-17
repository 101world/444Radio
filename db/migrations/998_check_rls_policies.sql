-- ============================================================================
-- DIAGNOSTIC: Check existing RLS policies and their column references
-- Run this BEFORE the performance fix migration to understand your schema
-- ============================================================================

-- List all policies with their actual SQL conditions
SELECT 
    schemaname,
    tablename,
    policyname,
    CASE 
        WHEN cmd = 'SELECT' THEN 'SELECT'
        WHEN cmd = 'INSERT' THEN 'INSERT'
        WHEN cmd = 'UPDATE' THEN 'UPDATE'
        WHEN cmd = 'DELETE' THEN 'DELETE'
        ELSE cmd
    END as operation,
    COALESCE(qual::text, '') as using_clause,
    COALESCE(with_check::text, '') as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
    AND (
        policyname LIKE '%update own%'
        OR policyname LIKE '%create own%'
        OR policyname LIKE '%delete own%'
        OR policyname LIKE '%insert own%'
        OR policyname LIKE '%view own%'
        OR policyname LIKE '%their own%'
        OR policyname LIKE '%follow%'
        OR policyname LIKE '%station%'
        OR policyname LIKE '%play credit%'
    )
ORDER BY tablename, policyname;

-- Check which tables have which user ID columns
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
    AND (
        column_name LIKE '%user_id%'
        OR column_name LIKE '%clerk%'
        OR column_name = 'follower_id'
        OR column_name = 'artist_clerk_user_id'
    )
ORDER BY table_name, column_name;
