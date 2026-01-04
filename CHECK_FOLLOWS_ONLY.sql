-- Just check follows table structure
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'follows' 
ORDER BY ordinal_position;
