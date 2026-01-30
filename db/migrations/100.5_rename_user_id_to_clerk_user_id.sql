-- ============================================================================
-- RENAME user_id TO clerk_user_id FOR CONSISTENCY
-- Run this BEFORE 101_fix_remaining_security_warnings.sql
-- Date: 2026-01-30
-- ============================================================================

-- Rename columns in tables that currently use user_id
-- These should all use clerk_user_id for consistency with other tables

-- Live Stations
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'live_stations') THEN
    IF EXISTS (SELECT FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'live_stations' 
               AND column_name = 'user_id') THEN
      ALTER TABLE public.live_stations RENAME COLUMN user_id TO clerk_user_id;
    END IF;
  END IF;
END $$;

-- Station Messages
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'station_messages') THEN
    IF EXISTS (SELECT FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'station_messages' 
               AND column_name = 'user_id') THEN
      ALTER TABLE public.station_messages RENAME COLUMN user_id TO clerk_user_id;
    END IF;
  END IF;
END $$;

-- Station Listeners
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'station_listeners') THEN
    IF EXISTS (SELECT FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'station_listeners' 
               AND column_name = 'user_id') THEN
      ALTER TABLE public.station_listeners RENAME COLUMN user_id TO clerk_user_id;
      
      -- Update unique constraint if it exists
      ALTER TABLE public.station_listeners DROP CONSTRAINT IF EXISTS station_listeners_station_id_user_id_key;
      ALTER TABLE public.station_listeners ADD CONSTRAINT station_listeners_station_id_clerk_user_id_key 
        UNIQUE(station_id, clerk_user_id);
    END IF;
  END IF;
END $$;

-- Play Credits
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'play_credits') THEN
    IF EXISTS (SELECT FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'play_credits' 
               AND column_name = 'user_id') THEN
      ALTER TABLE public.play_credits RENAME COLUMN user_id TO clerk_user_id;
      
      -- Update unique constraint if it exists
      ALTER TABLE public.play_credits DROP CONSTRAINT IF EXISTS play_credits_media_id_user_id_played_on_key;
      ALTER TABLE public.play_credits ADD CONSTRAINT play_credits_media_id_clerk_user_id_played_on_key 
        UNIQUE(media_id, clerk_user_id, played_on);
    END IF;
  END IF;
END $$;

-- Studio Jobs
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'studio_jobs') THEN
    IF EXISTS (SELECT FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'studio_jobs' 
               AND column_name = 'user_id') THEN
      ALTER TABLE public.studio_jobs RENAME COLUMN user_id TO clerk_user_id;
    END IF;
  END IF;
END $$;

-- Studio Projects
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'studio_projects') THEN
    IF EXISTS (SELECT FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'studio_projects' 
               AND column_name = 'user_id') THEN
      ALTER TABLE public.studio_projects RENAME COLUMN user_id TO clerk_user_id;
    END IF;
  END IF;
END $$;

-- Update indexes that reference user_id
DO $$ BEGIN
  -- Live Stations
  IF EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_live_stations_user_id') THEN
    DROP INDEX public.idx_live_stations_user_id;
    CREATE INDEX idx_live_stations_clerk_user_id ON public.live_stations(clerk_user_id);
  END IF;
  
  -- Play Credits
  IF EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_play_credits_user_id') THEN
    DROP INDEX public.idx_play_credits_user_id;
    CREATE INDEX idx_play_credits_clerk_user_id ON public.play_credits(clerk_user_id);
  END IF;
  
  IF EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_play_credits_media_user_date') THEN
    DROP INDEX public.idx_play_credits_media_user_date;
    CREATE INDEX idx_play_credits_media_clerk_user_date ON public.play_credits(media_id, clerk_user_id, played_on);
  END IF;
  
  -- Studio Jobs
  IF EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_studio_jobs_user_id') THEN
    DROP INDEX public.idx_studio_jobs_user_id;
    CREATE INDEX idx_studio_jobs_clerk_user_id ON public.studio_jobs(clerk_user_id);
  END IF;
END $$;

-- ============================================================================
-- COMPLETED - ALL user_id COLUMNS RENAMED TO clerk_user_id
-- Now run 101_fix_remaining_security_warnings.sql
-- ============================================================================
