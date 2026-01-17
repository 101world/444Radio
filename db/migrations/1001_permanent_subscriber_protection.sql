-- ============================================================================
-- PERMANENT FIX: Prevent Accidental Subscriber Credit Resets
-- Date: 2026-01-12
-- Creates database constraints and triggers to protect subscriber credits
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: Create a function to protect subscriber credits
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_subscriber_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- If user has active subscription
  IF NEW.subscription_status = 'active' THEN
    -- Ensure they always have unlimited credits
    IF NEW.credits < 999999 THEN
      NEW.credits = 999999;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- PART 2: Create trigger to auto-protect subscribers
-- ============================================================================

DROP TRIGGER IF EXISTS ensure_subscriber_credits ON public.users;

CREATE TRIGGER ensure_subscriber_credits
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_subscriber_credits();

-- ============================================================================
-- PART 3: Create a safe stored procedure for credit resets
-- ============================================================================

CREATE OR REPLACE FUNCTION public.safe_reset_free_user_credits()
RETURNS TABLE (
  users_affected integer,
  subscribers_protected integer,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  free_users_count integer;
  subscriber_count integer;
BEGIN
  -- Count free users who will be affected
  SELECT COUNT(*) INTO free_users_count
  FROM public.users
  WHERE (subscription_status IS NULL OR subscription_status != 'active')
  AND credits != 20;
  
  -- Count active subscribers (should NOT be affected)
  SELECT COUNT(*) INTO subscriber_count
  FROM public.users
  WHERE subscription_status = 'active';
  
  -- Reset only free users
  UPDATE public.users
  SET credits = 20, updated_at = NOW()
  WHERE 
    (subscription_status IS NULL OR subscription_status != 'active')
    AND credits != 20;
  
  -- Return summary
  RETURN QUERY SELECT 
    free_users_count,
    subscriber_count,
    format('Reset %s free users to 20 credits. Protected %s subscribers.', 
           free_users_count, subscriber_count);
END;
$$;

-- ============================================================================
-- PART 4: Create view for safe credit management
-- ============================================================================

CREATE OR REPLACE VIEW public.credit_management_safe AS
SELECT 
  clerk_user_id,
  username,
  email,
  credits,
  subscription_status,
  subscription_plan,
  CASE 
    WHEN subscription_status = 'active' THEN '🔒 PROTECTED - Do not modify'
    WHEN credits < 10 THEN '⚠️ Low credits'
    WHEN credits = 20 THEN '✅ Default'
    WHEN credits > 20 AND credits < 999999 THEN '💰 Bonus credits'
    ELSE '♾️ Unlimited'
  END as status,
  created_at,
  updated_at
FROM public.users
ORDER BY 
  CASE WHEN subscription_status = 'active' THEN 1 ELSE 2 END,
  credits DESC;

-- Grant access to view
GRANT SELECT ON public.credit_management_safe TO authenticated;

COMMIT;

-- ============================================================================
-- USAGE INSTRUCTIONS
-- ============================================================================

-- To safely reset free user credits, use:
-- SELECT * FROM public.safe_reset_free_user_credits();

-- To view credit status safely:
-- SELECT * FROM public.credit_management_safe;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Test that trigger works
DO $$
DECLARE
  test_user_id text := 'test_' || gen_random_uuid()::text;
BEGIN
  -- Create a test subscriber with low credits
  INSERT INTO public.users (clerk_user_id, username, email, credits, subscription_status)
  VALUES (test_user_id, 'test_user', 'test@example.com', 10, 'active');
  
  -- Verify credits were auto-set to unlimited
  PERFORM 1 FROM public.users 
  WHERE clerk_user_id = test_user_id AND credits = 999999;
  
  IF FOUND THEN
    RAISE NOTICE '✅ Trigger works: Subscriber credits auto-set to unlimited';
  ELSE
    RAISE EXCEPTION '❌ Trigger failed: Subscriber did not get unlimited credits';
  END IF;
  
  -- Cleanup test user
  DELETE FROM public.users WHERE clerk_user_id = test_user_id;
  
  RAISE NOTICE '✅ All protection mechanisms verified';
END;
$$;

-- ============================================================================
-- EMERGENCY DISABLE (only if issues occur)
-- ============================================================================

-- To temporarily disable protection:
-- DROP TRIGGER IF EXISTS ensure_subscriber_credits ON public.users;

-- To re-enable:
-- CREATE TRIGGER ensure_subscriber_credits
--   BEFORE INSERT OR UPDATE ON public.users
--   FOR EACH ROW
--   EXECUTE FUNCTION public.protect_subscriber_credits();
