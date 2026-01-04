-- Run this and copy ALL results (should be 2 tables of data)

-- RESULT 1: Columns in follows table
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'follows' 
ORDER BY ordinal_position;

-- RESULT 2: Columns in users table  
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;
