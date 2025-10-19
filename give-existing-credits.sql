-- Give all existing users 20 credits
-- Run this in Supabase SQL Editor

UPDATE users 
SET credits = 20 
WHERE credits = 0 OR credits IS NULL;

-- Verify the update
SELECT id, username, email, credits 
FROM users 
ORDER BY created_at DESC;
