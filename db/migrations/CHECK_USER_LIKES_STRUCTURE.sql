-- Quick query to check user_likes table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_likes' 
ORDER BY ordinal_position;

-- Also check a sample row
SELECT * FROM user_likes LIMIT 1;
