-- DIAGNOSTIC: Show exactly what exists for YOUR user
-- Replace with your actual user ID from when you log in

-- Step 1: Show ALL user IDs in combined_media with audio
SELECT 'ALL users in combined_media with audio:' as info;
SELECT user_id, COUNT(*) as songs
FROM combined_media
WHERE audio_url IS NOT NULL
GROUP BY user_id
ORDER BY songs DESC;

-- Step 2: Show sample of YOUR songs (update user_id below)
SELECT 'Sample songs in combined_media:' as info;
SELECT id, user_id, title, audio_url, created_at
FROM combined_media
WHERE audio_url IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;

-- Step 3: Check music_library current state
SELECT 'Current music_library state:' as info;
SELECT 
  clerk_user_id,
  user_id,
  COUNT(*) as songs
FROM music_library
GROUP BY clerk_user_id, user_id
ORDER BY songs DESC;

-- Step 4: Show what columns exist in music_library
SELECT 'music_library columns:' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'music_library'
ORDER BY ordinal_position;
