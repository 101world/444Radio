-- Find user ID for 101world
SELECT 
  id,
  clerk_user_id,
  username,
  email,
  created_at
FROM users
WHERE username ILIKE '%101%' 
   OR email ILIKE '%101%'
ORDER BY created_at DESC;

-- Show ALL users to find 101world
SELECT 
  id,
  clerk_user_id,
  username,
  email,
  created_at
FROM users
ORDER BY created_at DESC;
