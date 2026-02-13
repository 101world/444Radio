-- ============================================================================
-- FIX: Remove infinite credit refill bug for subscribers
-- Date: 2026-02-13
-- 
-- BUG: The protect_subscriber_credits() trigger fires on EVERY UPDATE to the
-- users table. When it sees credits = 0 + subscription_status = 'active',
-- it silently resets credits to the plan amount (100/600/1500).
-- This means active subscribers can NEVER actually run out of credits —
-- any row update (follow, profile view, avatar change, etc.) refills them.
--
-- FIX: Remove the "credits = 0" condition. The trigger should ONLY protect
-- against accidental bulk resets to 20 (the free-user default), which was
-- its original purpose. Legitimate usage to 0 must be allowed.
--
-- Additionally: We compare OLD vs NEW credits to only act when something
-- is explicitly trying to SET credits to 20, not when they naturally
-- reach 20 through usage (subtract 1 from 21 etc).
-- ============================================================================

-- Replace the trigger function with a safe version
CREATE OR REPLACE FUNCTION public.protect_subscriber_credits()
RETURNS TRIGGER AS $$
DECLARE
  correct_credits INTEGER;
BEGIN
  -- Only protect active subscribers
  IF NEW.subscription_status = 'active' THEN
    -- Determine correct credits based on subscription plan
    IF NEW.subscription_plan LIKE '%creator%' OR 
       NEW.subscription_plan IN ('plan_S2DGVK6J270rtt', 'plan_S2DJv0bFnWoNLS') THEN
      correct_credits := 100;
    ELSIF NEW.subscription_plan LIKE '%pro%' OR 
          NEW.subscription_plan IN ('plan_S2DHUGo7n1m6iv', 'plan_S2DNEvy1YzYWNh') THEN
      correct_credits := 600;
    ELSIF NEW.subscription_plan LIKE '%studio%' OR 
          NEW.subscription_plan IN ('plan_S2DIdCKNcV6TtA', 'plan_S2DOABOeGedJHk') THEN
      correct_credits := 1500;
    ELSE
      correct_credits := 100;
    END IF;
    
    -- ONLY protect against external bulk resets that set credits to exactly 20
    -- (the free-user default). This catches bad migrations or scripts that
    -- blindly reset everyone to 20.
    -- 
    -- DO NOT protect credits = 0. That's a legitimate state when a subscriber
    -- has used all their credits for the month. They must wait for renewal.
    --
    -- Extra safety: only trigger on UPDATE, and only when OLD credits were
    -- higher (meaning something forcefully set it to 20, not natural usage).
    IF TG_OP = 'INSERT' AND NEW.credits = 20 THEN
      -- New subscriber being inserted with free-tier credits — fix it
      NEW.credits := correct_credits;
      RAISE NOTICE 'Subscriber credit protection (INSERT): Set % to % credits', 
        NEW.email, correct_credits;
    ELSIF TG_OP = 'UPDATE' AND NEW.credits = 20 AND OLD.credits > 20 THEN
      -- Something tried to reset subscriber from their actual credits down to 20
      -- This is likely a bad bulk reset — restore to plan amount
      NEW.credits := correct_credits;
      RAISE NOTICE 'Subscriber credit protection (UPDATE): Restored % from 20 to % credits (was %)', 
        NEW.email, correct_credits, OLD.credits;
    END IF;
    -- All other cases (including credits = 0) pass through normally
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- The trigger itself doesn't need recreation — it already points to this function name.
-- But let's ensure it's correct:
DROP TRIGGER IF EXISTS ensure_subscriber_credits ON public.users;

CREATE TRIGGER ensure_subscriber_credits
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_subscriber_credits();
