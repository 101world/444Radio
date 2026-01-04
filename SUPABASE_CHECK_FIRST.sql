-- =====================================================
-- STEP 1: CHECK WHAT EXISTS IN YOUR DATABASE
-- Run this FIRST to see what you have
-- =====================================================

-- Check if users table exists and what columns it has
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- Check if followers table exists
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'followers' 
ORDER BY ordinal_position;

-- Count data in tables (if they exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        RAISE NOTICE 'Users table row count:';
        PERFORM COUNT(*) FROM users;
    ELSE
        RAISE NOTICE 'Users table does NOT exist';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'followers') THEN
        RAISE NOTICE 'Followers table row count:';
        PERFORM COUNT(*) FROM followers;
    ELSE
        RAISE NOTICE 'Followers table does NOT exist';
    END IF;
END $$;

-- List ALL tables in your database
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
