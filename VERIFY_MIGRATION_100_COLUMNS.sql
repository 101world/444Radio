-- ============================================================================
-- VERIFY MIGRATION 100 - Column Existence Check
-- Run this BEFORE running migration 100 to verify all columns exist
-- ============================================================================

-- Check combined_media columns used in views
DO $$
DECLARE
  missing_columns TEXT[] := '{}';
BEGIN
  -- Check each column exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'combined_media' AND column_name = 'id') THEN
    missing_columns := array_append(missing_columns, 'combined_media.id');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'combined_media' AND column_name = 'title') THEN
    missing_columns := array_append(missing_columns, 'combined_media.title');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'combined_media' AND column_name = 'genre') THEN
    missing_columns := array_append(missing_columns, 'combined_media.genre');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'combined_media' AND column_name = 'user_id') THEN
    missing_columns := array_append(missing_columns, 'combined_media.user_id');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'combined_media' AND column_name = 'created_at') THEN
    missing_columns := array_append(missing_columns, 'combined_media.created_at');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'combined_media' AND column_name = 'plays') THEN
    missing_columns := array_append(missing_columns, 'combined_media.plays');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'combined_media' AND column_name = 'likes_count') THEN
    missing_columns := array_append(missing_columns, 'combined_media.likes_count');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'combined_media' AND column_name = 'image_url') THEN
    missing_columns := array_append(missing_columns, 'combined_media.image_url');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'combined_media' AND column_name = 'audio_url') THEN
    missing_columns := array_append(missing_columns, 'combined_media.audio_url');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'combined_media' AND column_name = 'type') THEN
    missing_columns := array_append(missing_columns, 'combined_media.type');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'combined_media' AND column_name = 'is_public') THEN
    missing_columns := array_append(missing_columns, 'combined_media.is_public');
  END IF;

  -- Check users columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'username') THEN
    missing_columns := array_append(missing_columns, 'users.username');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'avatar_url') THEN
    missing_columns := array_append(missing_columns, 'users.avatar_url');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'clerk_user_id') THEN
    missing_columns := array_append(missing_columns, 'users.clerk_user_id');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'credits') THEN
    missing_columns := array_append(missing_columns, 'users.credits');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'total_generated') THEN
    missing_columns := array_append(missing_columns, 'users.total_generated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'updated_at') THEN
    missing_columns := array_append(missing_columns, 'users.updated_at');
  END IF;

  -- Report results
  IF array_length(missing_columns, 1) > 0 THEN
    RAISE EXCEPTION 'Missing columns: %', array_to_string(missing_columns, ', ');
  ELSE
    RAISE NOTICE '✅ All required columns exist!';
    RAISE NOTICE '   - combined_media: 11 columns verified';
    RAISE NOTICE '   - users: 6 columns verified';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Migration 100 is safe to run!';
  END IF;
END $$;
