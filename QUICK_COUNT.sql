-- Count songs in combined_media for all user IDs
SELECT 
  'Songs in combined_media (source of truth)' as location,
  COUNT(*) as total_songs
FROM combined_media
WHERE audio_url IS NOT NULL
AND user_id IN (
  'user_34TAjF6JtnxUyWn8nXx9tq7A3VC',
  'user_35HWELeD4pRQTRxTfGvWP28TnIP',
  'user_34vm60RVmcQgL18b0bpS1sTYhZ',
  'user_34ThsuzQnqd8zqkK5dGPrfREyoU',
  'user_34tKVS04YVAZHi7iHSr3aaZlU60',
  'user_34StnaXDJ3yZTYmz1Wmv3sYcqcB'
);

-- Count songs in music_library (current library)
SELECT 
  'Songs in music_library (what you see)' as location,
  COUNT(*) as total_songs
FROM music_library
WHERE clerk_user_id IN (
  'user_34TAjF6JtnxUyWn8nXx9tq7A3VC',
  'user_35HWELeD4pRQTRxTfGvWP28TnIP',
  'user_34vm60RVmcQgL18b0bpS1sTYhZ',
  'user_34ThsuzQnqd8zqkK5dGPrfREyoU',
  'user_34tKVS04YVAZHi7iHSr3aaZlU60',
  'user_34StnaXDJ3yZTYmz1Wmv3sYcqcB'
)
OR user_id IN (
  'user_34TAjF6JtnxUyWn8nXx9tq7A3VC',
  'user_35HWELeD4pRQTRxTfGvWP28TnIP',
  'user_34vm60RVmcQgL18b0bpS1sTYhZ',
  'user_34ThsuzQnqd8zqkK5dGPrfREyoU',
  'user_34tKVS04YVAZHi7iHSr3aaZlU60',
  'user_34StnaXDJ3yZTYmz1Wmv3sYcqcB'
);

-- This shows the difference = missing songs
