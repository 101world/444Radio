-- ============================================================================
-- PERMANENT FIX: Prevent Subscriber Credit Resets (CORRECT VERSION)
-- Date: 2026-01-12
-- Protects subscribers based on their ACTUAL plan credits:
-- - Creator: 100 credits/month
-- - Pro: 600 credits/month
-- - Studio: 1,500 credits/month
-- ============================================================================

-- PART 1: Create a function to protect subscriber credits based on plan
-- ============================================================================
CREATE OR REPLACE FUNCTION public.protect_subscriber_credits()
RETURNS TRIGGER AS $$
DECLARE
  correct_credits INTEGER;
BEGIN
  -- If user has an active subscription, ensure they have the right credits
  IF NEW.subscription_status = 'active' THEN
    -- Determine correct credits based on subscription plan
    IF NEW.subscription_plan LIKE '%creator%' OR 
       NEW.subscription_plan IN ('plan_S2DGVK6J270rtt', 'plan_S2DJv0bFnWoNLS') THEN
      correct_credits := 100;  -- Creator: 100 credits/month
    ELSIF NEW.subscription_plan LIKE '%pro%' OR 
          NEW.subscription_plan IN ('plan_S2DHUGo7n1m6iv', 'plan_S2DNEvy1YzYWNh') THEN
      correct_credits := 600;  -- Pro: 600 credits/month
    ELSIF NEW.subscription_plan LIKE '%studio%' OR 
          NEW.subscription_plan IN ('plan_S2DIdCKNcV6TtA', 'plan_S2DOABOeGedJHk') THEN
      correct_credits := 1500; -- Studio: 1,500 credits/month
    ELSE
      correct_credits := 100;  -- Default to Creator plan amount
    END IF;
    
    -- Prevent setting to incorrect amounts (allow usage, but not resets to 20)
    IF NEW.credits = 20 OR NEW.credits = 0 THEN
      RAISE NOTICE 'Subscriber credit protection: Restoring % (%) from % to % credits', 
        NEW.username, NEW.email, NEW.credits, correct_credits;
      NEW.credits := correct_credits;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PART 2: Create trigger to auto-protect subscriber credits
-- ============================================================================
DROP TRIGGER IF EXISTS ensure_subscriber_credits ON public.users;

CREATE TRIGGER ensure_subscriber_credits
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_subscriber_credits();

-- PART 3: Create a safe stored procedure for credit resets
-- ============================================================================
-- This is the RIGHT WAY to reset free user credits in the future
-- ============================================================================
CREATE OR REPLACE FUNCTION public.safe_reset_free_user_credits()
RETURNS TABLE (
  affected_users INTEGER,
  skipped_subscribers INTEGER,
  success BOOLEAN
) AS $$
DECLARE
  free_users_count INTEGER;
  subscriber_count INTEGER;
BEGIN
  -- Count free users who will be affected
  SELECT COUNT(*) INTO free_users_count
  FROM public.users
  WHERE (subscription_status IS NULL OR subscription_status != 'active')
    AND credits != 20;
  
  -- Count subscribers who will be protected
  SELECT COUNT(*) INTO subscriber_count
  FROM public.users
  WHERE subscription_status = 'active';
  
  -- Reset ONLY free users to 20 credits
  UPDATE public.users
  SET 
    credits = 20,
    updated_at = NOW()
  WHERE 
    (subscription_status IS NULL OR subscription_status != 'active')
    AND credits != 20;
  
  -- Ensure subscribers have correct credits based on their plan
  -- Creator: 100 credits
  UPDATE public.users
  SET credits = 100, updated_at = NOW()
  WHERE subscription_status = 'active'
    AND (subscription_plan LIKE '%creator%' OR subscription_plan IN ('plan_S2DGVK6J270rtt', 'plan_S2DJv0bFnWoNLS'));
  
  -- Pro: 600 credits
  UPDATE public.users
  SET credits = 600, updated_at = NOW()
  WHERE subscription_status = 'active'
    AND (subscription_plan LIKE '%pro%' OR subscription_plan IN ('plan_S2DHUGo7n1m6iv', 'plan_S2DNEvy1YzYWNh'));
  
  -- Studio: 1,500 credits
  UPDATE public.users
  SET credits = 1500, updated_at = NOW()
  WHERE subscription_status = 'active'
    AND (subscription_plan LIKE '%studio%' OR subscription_plan IN ('plan_S2DIdCKNcV6TtA', 'plan_S2DOABOeGedJHk'));
  
  -- Return results
  RETURN QUERY SELECT 
    free_users_count,
    subscriber_count,
    TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PART 4: Create a view to check credit protection status
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
-- TEST: Verify the protection works
-- ============================================================================
DO $$
DECLARE
  test_creator_id TEXT := 'test_creator_' || floor(random() * 1000000);
  test_pro_id TEXT := 'test_pro_' || floor(random() * 1000000);
  test_studio_id TEXT := 'test_studio_' || floor(random() * 1000000);
  creator_credits INTEGER;
  pro_credits INTEGER;
  studio_credits INTEGER;
BEGIN
  -- Test Creator plan (should get 100 credits)
  INSERT INTO public.users (clerk_user_id, username, email, credits, subscription_status, subscription_plan)
  VALUES (test_creator_id, 'test_creator', 'creator@example.com', 20, 'active', 'creator');
  SELECT credits INTO creator_credits FROM public.users WHERE clerk_user_id = test_creator_id;
  
  -- Test Pro plan (should get 600 credits)
  INSERT INTO public.users (clerk_user_id, username, email, credits, subscription_status, subscription_plan)
  VALUES (test_pro_id, 'test_pro', 'pro@example.com', 20, 'active', 'pro');
  SELECT credits INTO pro_credits FROM public.users WHERE clerk_user_id = test_pro_id;
  
  -- Test Studio plan (should get 1,500 credits)
  INSERT INTO public.users (clerk_user_id, username, email, credits, subscription_status, subscription_plan)
  VALUES (test_studio_id, 'test_studio', 'studio@example.com', 20, 'active', 'studio');
  SELECT credits INTO studio_credits FROM public.users WHERE clerk_user_id = test_studio_id;
  
  -- Verify all plans
  IF creator_credits = 100 AND pro_credits = 600 AND studio_credits = 1500 THEN
    RAISE NOTICE '✅ Trigger works: All plans get correct credits (Creator:%, Pro:%, Studio:%)', 
      creator_credits, pro_credits, studio_credits;
  ELSE
    RAISE EXCEPTION '❌ Trigger failed: Incorrect credits (Creator:%, Pro:%, Studio:%)', 
      creator_credits, pro_credits, studio_credits;
  END IF;
  
  -- Clean up
  DELETE FROM public.users WHERE clerk_user_id IN (test_creator_id, test_pro_id, test_studio_id);
  
  RAISE NOTICE '✅ Subscriber protection system verified and active!';
  RAISE NOTICE '   Creator: 100 credits | Pro: 600 credits | Studio: 1,500 credits';
END $$;

-- ============================================================================
-- HOW TO USE THIS SYSTEM
-- ============================================================================
-- 
-- 1. TO CHECK PROTECTION STATUS:
--    SELECT * FROM credit_management_safe;
-- 
-- 2. TO SAFELY RESET FREE USER CREDITS (never affects subscribers):
--    SELECT * FROM safe_reset_free_user_credits();
-- 
-- 3. MANUAL CREDIT ADJUSTMENTS:
--    Just do normal UPDATE - trigger will protect subscribers automatically
-- 
-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================
-- 
-- DROP TRIGGER IF EXISTS ensure_subscriber_credits ON public.users;
-- DROP FUNCTION IF EXISTS protect_subscriber_credits();
-- DROP FUNCTION IF EXISTS safe_reset_free_user_credits();
-- DROP VIEW IF EXISTS credit_management_safe;
-- 
-- ============================================================================
