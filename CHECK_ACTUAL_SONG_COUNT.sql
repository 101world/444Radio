-- Count ACTUAL unique songs in combined_media
SELECT 
  'Total rows with audio:' as metric,
  COUNT(*) as count
FROM combined_media
WHERE user_id = 'user_34IRTbbo6kCHjWMZvXYTBWepAtw'
AND audio_url IS NOT NULL;

SELECT 
  'UNIQUE audio URLs:' as metric,
  COUNT(DISTINCT audio_url) as count
FROM combined_media
WHERE user_id = 'user_34IRTbbo6kCHjWMZvXYTBWepAtw'
AND audio_url IS NOT NULL;

-- Show the breakdown
SELECT 
  audio_url,
  COUNT(*) as times_appears,
  STRING_AGG(DISTINCT title, ', ') as all_titles
FROM combined_media
WHERE user_id = 'user_34IRTbbo6kCHjWMZvXYTBWepAtw'
AND audio_url IS NOT NULL
GROUP BY audio_url
ORDER BY times_appears DESC, audio_url
LIMIT 50;
