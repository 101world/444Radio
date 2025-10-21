-- ============================================
-- RESET ALL USER CREDITS TO 20
-- ============================================
-- This script updates all users in the database 
-- to have exactly 20 credits.
--
-- Run this in your Supabase SQL Editor:
-- 1. Go to your Supabase dashboard
-- 2. Navigate to SQL Editor
-- 3. Copy and paste this script
-- 4. Click "Run" to execute
-- ============================================

-- Update all existing users to have 20 credits
UPDATE users 
SET credits = 20
WHERE credits != 20;

-- Show results
SELECT 
  clerk_user_id,
  email,
  credits,
  total_generated,
  created_at
FROM users
ORDER BY created_at DESC;

-- Summary: Count of users by credit amount
SELECT 
  credits,
  COUNT(*) as user_count
FROM users
GROUP BY credits
ORDER BY credits DESC;
