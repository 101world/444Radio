-- Check banner data for user_34IkVS04YVAZH371HSr3aaZlU60
SELECT 
  clerk_user_id,
  username,
  banner_url,
  banner_type,
  length(banner_url) as url_length,
  banner_url LIKE '%\n%' as has_newline,
  banner_url LIKE '%\r%' as has_carriage_return
FROM users 
WHERE clerk_user_id = 'user_34IkVS04YVAZH371HSr3aaZlU60';
