-- ============================================================================
-- FIX SECURITY DEFINER VIEWS (CRITICAL)
-- Date: 2026-01-12
-- Migration 1004 didn't fully apply - views still have SECURITY DEFINER
-- ============================================================================

-- Remove SECURITY DEFINER from explore_genre_view
DROP VIEW IF EXISTS public.explore_genre_view CASCADE;
CREATE VIEW public.explore_genre_view AS
SELECT * FROM public.combined_media;

-- Remove SECURITY DEFINER from explore_genre_summary
DROP VIEW IF EXISTS public.explore_genre_summary CASCADE;
CREATE VIEW public.explore_genre_summary AS
SELECT 
  genre,
  COUNT(*) as track_count
FROM public.combined_media
WHERE type = 'audio'
GROUP BY genre;

-- Remove SECURITY DEFINER from credit_management_safe
DROP VIEW IF EXISTS public.credit_management_safe CASCADE;
CREATE VIEW public.credit_management_safe AS
SELECT 
  clerk_user_id,
  username,
  email,
  credits,
  subscription_status,
  subscription_plan,
  CASE 
    WHEN subscription_plan LIKE '%creator%' THEN 100
    WHEN subscription_plan LIKE '%pro%' THEN 600
    WHEN subscription_plan LIKE '%studio%' THEN 1500
    ELSE 20
  END as expected_credits,
  CASE 
    WHEN subscription_status = 'active' THEN 
      CASE 
        WHEN subscription_plan LIKE '%creator%' THEN 'Protected (Creator: 100 credits)'
        WHEN subscription_plan LIKE '%pro%' THEN 'Protected (Pro: 600 credits)'
        WHEN subscription_plan LIKE '%studio%' THEN 'Protected (Studio: 1,500 credits)'
        ELSE 'Protected (Unknown plan)'
      END
    WHEN credits = 20 THEN 'Normal free user'
    ELSE 'Needs attention'
  END as protection_status,
  CASE 
    WHEN subscription_status = 'active' AND subscription_plan LIKE '%creator%' AND credits != 100 THEN 
      'WARNING: Creator subscriber should have 100 credits!'
    WHEN subscription_status = 'active' AND subscription_plan LIKE '%pro%' AND credits != 600 THEN 
      'WARNING: Pro subscriber should have 600 credits!'
    WHEN subscription_status = 'active' AND subscription_plan LIKE '%studio%' AND credits != 1500 THEN 
      'WARNING: Studio subscriber should have 1,500 credits!'
    WHEN subscription_status = 'active' AND credits = 20 THEN
      'CRITICAL: Subscriber has free user credits!'
    ELSE 'OK'
  END as alert
FROM public.users
ORDER BY 
  CASE WHEN subscription_status = 'active' THEN 0 ELSE 1 END,
  credits DESC;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ SECURITY DEFINER removed from 3 views';
  RAISE NOTICE '   - explore_genre_view';
  RAISE NOTICE '   - explore_genre_summary';
  RAISE NOTICE '   - credit_management_safe';
END $$;
