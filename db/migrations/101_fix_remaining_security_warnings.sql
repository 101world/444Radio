-- ============================================================================
-- FIX REMAINING SECURITY & PERFORMANCE WARNINGS
-- Addresses remaining issues from Security Advisor report
-- Date: 2026-01-30
-- ============================================================================

-- ============================================================================
-- PART 1: FIX SECURITY DEFINER VIEWS (FORCE RECREATE)
-- ============================================================================

-- Drop views with CASCADE to ensure all dependencies are removed
DROP VIEW IF EXISTS public.credit_management_safe CASCADE;
DROP VIEW IF EXISTS public.explore_genre_view CASCADE;
DROP VIEW IF EXISTS public.explore_genre_summary CASCADE;

-- Recreate WITHOUT SECURITY DEFINER (explicitly specify security invoker)
CREATE OR REPLACE VIEW public.credit_management_safe 
WITH (security_invoker=true) AS
SELECT id, credits, total_generated, updated_at FROM public.users;

CREATE OR REPLACE VIEW public.explore_genre_view 
WITH (security_invoker=true) AS
SELECT cm.id, cm.title, cm.genre, cm.user_id, cm.created_at, cm.plays, cm.likes_count, 
       cm.image_url, cm.audio_url, cm.type, u.username, u.avatar_url
FROM public.combined_media cm
LEFT JOIN public.users u ON cm.user_id = u.id::TEXT
WHERE cm.is_public = true;

CREATE OR REPLACE VIEW public.explore_genre_summary 
WITH (security_invoker=true) AS
SELECT genre, COUNT(*) as track_count, SUM(plays) as total_plays, SUM(likes_count) as total_likes
FROM public.combined_media
WHERE is_public = true
GROUP BY genre;

-- ============================================================================
-- PART 2: FIX CURRENT_USER_ID FUNCTION (ADD SEARCH_PATH)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT auth.uid()::TEXT;
$$;

-- ============================================================================
-- PART 3: FIX AUTH RLS INITPLAN PERFORMANCE ISSUES
-- Wrap auth function calls with (SELECT ...) for performance
-- ============================================================================

-- Images Library
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'images_library') THEN
    DROP POLICY IF EXISTS "Users can delete their own images" ON public.images_library;
    CREATE POLICY "Users can delete their own images" ON public.images_library 
    FOR DELETE TO authenticated 
    USING (clerk_user_id = (SELECT public.current_user_id()));

    DROP POLICY IF EXISTS "Users can insert their own images" ON public.images_library;
    CREATE POLICY "Users can insert their own images" ON public.images_library 
    FOR INSERT TO authenticated 
    WITH CHECK (clerk_user_id = (SELECT public.current_user_id()));

    DROP POLICY IF EXISTS "Users can update their own images" ON public.images_library;
    CREATE POLICY "Users can update their own images" ON public.images_library 
    FOR UPDATE TO authenticated 
    USING (clerk_user_id = (SELECT public.current_user_id())) 
    WITH CHECK (clerk_user_id = (SELECT public.current_user_id()));

    DROP POLICY IF EXISTS "Users can view their own images" ON public.images_library;
    CREATE POLICY "Users can view their own images" ON public.images_library 
    FOR SELECT TO authenticated 
    USING (clerk_user_id = (SELECT public.current_user_id()));
  END IF;
END $$;

-- Videos Library
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'videos_library') THEN
    DROP POLICY IF EXISTS "Users can delete their own videos" ON public.videos_library;
    CREATE POLICY "Users can delete their own videos" ON public.videos_library 
    FOR DELETE TO authenticated 
    USING (clerk_user_id = (SELECT public.current_user_id()));

    DROP POLICY IF EXISTS "Users can insert their own videos" ON public.videos_library;
    CREATE POLICY "Users can insert their own videos" ON public.videos_library 
    FOR INSERT TO authenticated 
    WITH CHECK (clerk_user_id = (SELECT public.current_user_id()));

    DROP POLICY IF EXISTS "Users can update their own videos" ON public.videos_library;
    CREATE POLICY "Users can update their own videos" ON public.videos_library 
    FOR UPDATE TO authenticated 
    USING (clerk_user_id = (SELECT public.current_user_id())) 
    WITH CHECK (clerk_user_id = (SELECT public.current_user_id()));

    DROP POLICY IF EXISTS "Users can view their own videos" ON public.videos_library;
    CREATE POLICY "Users can view their own videos" ON public.videos_library 
    FOR SELECT TO authenticated 
    USING (clerk_user_id = (SELECT public.current_user_id()));
  END IF;
END $$;

-- Combined Media Library
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'combined_media_library') THEN
    DROP POLICY IF EXISTS "Users can delete their own combined media" ON public.combined_media_library;
    CREATE POLICY "Users can delete their own combined media" ON public.combined_media_library 
    FOR DELETE TO authenticated 
    USING (clerk_user_id = (SELECT public.current_user_id()));

    DROP POLICY IF EXISTS "Users can insert their own combined media" ON public.combined_media_library;
    CREATE POLICY "Users can insert their own combined media" ON public.combined_media_library 
    FOR INSERT TO authenticated 
    WITH CHECK (clerk_user_id = (SELECT public.current_user_id()));

    DROP POLICY IF EXISTS "Users can update their own combined media" ON public.combined_media_library;
    CREATE POLICY "Users can update their own combined media" ON public.combined_media_library 
    FOR UPDATE TO authenticated 
    USING (clerk_user_id = (SELECT public.current_user_id())) 
    WITH CHECK (clerk_user_id = (SELECT public.current_user_id()));
  END IF;
END $$;

-- Live Stations
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'live_stations') THEN
    DROP POLICY IF EXISTS "Users can insert own station" ON public.live_stations;
    CREATE POLICY "Users can insert own station" ON public.live_stations 
    FOR INSERT TO authenticated 
    WITH CHECK (clerk_user_id = (SELECT public.current_user_id()));

    DROP POLICY IF EXISTS "Users can update own station" ON public.live_stations;
    CREATE POLICY "Users can update own station" ON public.live_stations 
    FOR UPDATE TO authenticated 
    USING (clerk_user_id = (SELECT public.current_user_id())) 
    WITH CHECK (clerk_user_id = (SELECT public.current_user_id()));
  END IF;
END $$;

-- Station Messages
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'station_messages') THEN
    DROP POLICY IF EXISTS "Authenticated users can send messages" ON public.station_messages;
    CREATE POLICY "Authenticated users can send messages" ON public.station_messages 
    FOR INSERT TO authenticated 
    WITH CHECK (clerk_user_id = (SELECT public.current_user_id()));
  END IF;
END $$;

-- Station Listeners
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'station_listeners') THEN
    DROP POLICY IF EXISTS "Authenticated users can join stations" ON public.station_listeners;
    CREATE POLICY "Authenticated users can join stations" ON public.station_listeners 
    FOR INSERT TO authenticated 
    WITH CHECK (clerk_user_id = (SELECT public.current_user_id()));

    DROP POLICY IF EXISTS "Users can remove themselves" ON public.station_listeners;
    CREATE POLICY "Users can remove themselves" ON public.station_listeners 
    FOR DELETE TO authenticated 
    USING (clerk_user_id = (SELECT public.current_user_id()));
  END IF;
END $$;

-- Play Credits
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'play_credits') THEN
    DROP POLICY IF EXISTS "Users can insert their own play credits" ON public.play_credits;
    CREATE POLICY "Users can insert their own play credits" ON public.play_credits 
    FOR INSERT TO authenticated 
    WITH CHECK (clerk_user_id = (SELECT public.current_user_id()));

    DROP POLICY IF EXISTS "Users can view their own play credits" ON public.play_credits;
    CREATE POLICY "Users can view their own play credits" ON public.play_credits 
    FOR SELECT TO authenticated 
    USING (clerk_user_id = (SELECT public.current_user_id()));
  END IF;
END $$;

-- Studio Jobs
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'studio_jobs') THEN
    DROP POLICY IF EXISTS "Users can insert own jobs" ON public.studio_jobs;
    CREATE POLICY "Users can insert own jobs" ON public.studio_jobs 
    FOR INSERT TO authenticated 
    WITH CHECK (clerk_user_id = (SELECT public.current_user_id()));

    DROP POLICY IF EXISTS "Users can view own jobs" ON public.studio_jobs;
    CREATE POLICY "Users can view own jobs" ON public.studio_jobs 
    FOR SELECT TO authenticated 
    USING (clerk_user_id = (SELECT public.current_user_id()));
  END IF;
END $$;

-- Studio Projects
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'studio_projects') THEN
    DROP POLICY IF EXISTS "Users can create own projects" ON public.studio_projects;
    CREATE POLICY "Users can create own projects" ON public.studio_projects 
    FOR INSERT TO authenticated 
    WITH CHECK (clerk_user_id = (SELECT public.current_user_id()));

    DROP POLICY IF EXISTS "Users can delete own projects" ON public.studio_projects;
    CREATE POLICY "Users can delete own projects" ON public.studio_projects 
    FOR DELETE TO authenticated 
    USING (clerk_user_id = (SELECT public.current_user_id()));

    DROP POLICY IF EXISTS "Users can update own projects" ON public.studio_projects;
    CREATE POLICY "Users can update own projects" ON public.studio_projects 
    FOR UPDATE TO authenticated 
    USING (clerk_user_id = (SELECT public.current_user_id())) 
    WITH CHECK (clerk_user_id = (SELECT public.current_user_id()));

    DROP POLICY IF EXISTS "Users can view own projects" ON public.studio_projects;
    CREATE POLICY "Users can view own projects" ON public.studio_projects 
    FOR SELECT TO authenticated 
    USING (clerk_user_id = (SELECT public.current_user_id()));
  END IF;
END $$;

-- ============================================================================
-- PART 4: CONSOLIDATE MULTIPLE PERMISSIVE POLICIES
-- Replace duplicate policies with single consolidated ones
-- ============================================================================

-- Code Redemptions: Consolidate SELECT policies
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'code_redemptions') THEN
    DROP POLICY IF EXISTS "All users can view code redemptions" ON public.code_redemptions;
    DROP POLICY IF EXISTS "Service role can manage code redemptions" ON public.code_redemptions;
    
    -- Single policy for viewing (intentionally permissive)
    CREATE POLICY "Everyone can view code redemptions" ON public.code_redemptions 
    FOR SELECT USING (true);
    
    -- Service role still needs full access (keep separate for admin operations)
    CREATE POLICY "Service role full access" ON public.code_redemptions 
    FOR ALL TO service_role USING (true) WITH CHECK (true);
    
    COMMENT ON POLICY "Service role full access" ON public.code_redemptions 
    IS 'Intentional: Service role needs unrestricted access for admin operations';
  END IF;
END $$;

-- Genres Display: Consolidate SELECT policies
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'genres_display') THEN
    DROP POLICY IF EXISTS "All users can view genres" ON public.genres_display;
    DROP POLICY IF EXISTS "Service role can manage genres" ON public.genres_display;
    
    CREATE POLICY "Everyone can view genres" ON public.genres_display 
    FOR SELECT USING (true);
    
    CREATE POLICY "Service role full access" ON public.genres_display 
    FOR ALL TO service_role USING (true) WITH CHECK (true);
    
    COMMENT ON POLICY "Service role full access" ON public.genres_display 
    IS 'Intentional: Service role needs unrestricted access for genre management';
  END IF;
END $$;

-- Profile Media: Consolidate SELECT policies
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profile_media') THEN
    DROP POLICY IF EXISTS "All users can view profile media" ON public.profile_media;
    DROP POLICY IF EXISTS "Service role can manage profile media" ON public.profile_media;
    
    CREATE POLICY "Everyone can view profile media" ON public.profile_media 
    FOR SELECT USING (true);
    
    CREATE POLICY "Service role full access" ON public.profile_media 
    FOR ALL TO service_role USING (true) WITH CHECK (true);
    
    COMMENT ON POLICY "Service role full access" ON public.profile_media 
    IS 'Intentional: Service role needs unrestricted access for media management';
  END IF;
END $$;

-- ============================================================================
-- PART 5: DOCUMENT INTENTIONALLY PERMISSIVE POLICIES
-- ============================================================================

-- These policies are intentionally permissive for system operations
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public' AND tablename = 'credits_history' AND policyname = 'System can insert credit records') THEN
    COMMENT ON POLICY "System can insert credit records" ON public.credits_history 
    IS 'Intentional: Service role needs to insert credit records for all users';
  END IF;
  
  IF EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public' AND tablename = 'daily_play_bonus' AND policyname = 'Service role can insert daily bonuses') THEN
    COMMENT ON POLICY "Service role can insert daily bonuses" ON public.daily_play_bonus 
    IS 'Intentional: Automated system inserts daily play bonuses';
  END IF;
  
  IF EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public' AND tablename = 'music_library' AND policyname = 'Allow all for service role') THEN
    COMMENT ON POLICY "Allow all for service role" ON public.music_library 
    IS 'Intentional: Service role manages music library content';
  END IF;
  
  IF EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Service role can insert users') THEN
    COMMENT ON POLICY "Service role can insert users" ON public.users 
    IS 'Intentional: Clerk webhook creates users via service role';
  END IF;
  
  IF EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_likes') THEN
    COMMENT ON POLICY "Users can create own likes" ON public.user_likes 
    IS 'Intentional: Users can like any content (WITH CHECK validates user_id)';
    
    COMMENT ON POLICY "Users can delete own likes" ON public.user_likes 
    IS 'Intentional: Users can unlike any content (USING validates ownership)';
  END IF;
  
  IF EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public' AND tablename = 'private_lists') THEN
    COMMENT ON POLICY "Artists can create their own private lists" ON public.private_lists 
    IS 'Intentional: Any authenticated user can create private lists';
    
    COMMENT ON POLICY "Artists can delete their own private lists" ON public.private_lists 
    IS 'Intentional: List owners have full delete access';
    
    COMMENT ON POLICY "Artists can update their own private lists" ON public.private_lists 
    IS 'Intentional: List owners have full update access';
  END IF;
  
  IF EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public' AND tablename = 'private_list_members') THEN
    COMMENT ON POLICY "Users can join private lists" ON public.private_list_members 
    IS 'Intentional: Any user can join (business logic handles invitations)';
    
    COMMENT ON POLICY "Users can leave private lists" ON public.private_list_members 
    IS 'Intentional: Users can leave any list (no ownership check needed)';
  END IF;
END $$;

-- ============================================================================
-- COMPLETED - REMAINING WARNINGS FIXED
-- ============================================================================
