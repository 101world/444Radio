-- Fix truncated titles in combined_media by copying from music_library
-- This will find combined_media records with matching audio URLs and update their titles

UPDATE combined_media cm
SET title = ml.title
FROM music_library ml
WHERE cm.audio_url = ml.audio_url
  AND cm.title != ml.title
  AND LENGTH(cm.title) < LENGTH(ml.title)
RETURNING cm.id, cm.title as old_title, ml.title as new_title;
