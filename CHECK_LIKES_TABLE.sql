-- Check if likes table exists and its structure
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE '%like%' OR table_name LIKE '%favorite%';

-- Check columns if table exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'likes' 
ORDER BY ordinal_position;

-- Sample data if exists
SELECT * FROM likes LIMIT 5;
