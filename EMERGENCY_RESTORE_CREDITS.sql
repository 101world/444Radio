-- ============================================
-- EMERGENCY: RESTORE ALL USER CREDITS
-- ============================================
-- This restores credits to 20 for all users
-- Run this in Supabase SQL Editor NOW
-- ============================================

-- See current state
SELECT clerk_user_id, username, credits, total_generated 
FROM users 
ORDER BY created_at DESC;

-- RESTORE: Set all users to 20 credits
UPDATE users 
SET credits = 20
WHERE credits = 0 OR credits IS NULL;

-- Verify the fix
SELECT 
  COUNT(*) as total_users,
  SUM(CASE WHEN credits >= 20 THEN 1 ELSE 0 END) as users_with_credits,
  SUM(CASE WHEN credits = 0 THEN 1 ELSE 0 END) as users_with_zero
FROM users;

-- Show updated results
SELECT clerk_user_id, username, credits, total_generated 
FROM users 
ORDER BY created_at DESC
LIMIT 20;
