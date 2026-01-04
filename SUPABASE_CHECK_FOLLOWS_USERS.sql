-- Check the structure of the 'follows' table that EXISTS
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'follows' 
ORDER BY ordinal_position;

-- Check users table columns (especially avatar vs profile_image)
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- Count rows
SELECT 'follows' as table_name, COUNT(*) as row_count FROM follows
UNION ALL
SELECT 'users' as table_name, COUNT(*) as row_count FROM users;
