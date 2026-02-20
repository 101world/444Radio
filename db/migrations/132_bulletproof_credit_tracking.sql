-- ============================================================================
-- 132: BULLETPROOF CREDIT TRACKING SYSTEM
--
-- Ensures EVERY credit that enters the system is:
--   1. Deducted from the 444 billion admin allocation
--   2. Logged in credit_transactions table
--   3. Tracked with proper metadata
--   4. Auditable at any time
--
-- Creates centralized RPC functions that replace direct UPDATE statements
-- Date: 2026-02-20
-- ============================================================================

-- ── 1. Centralized award_credits() RPC ────────────────────────────────────
-- This MUST be used for ALL credit additions (except deduct_credits refunds)
-- Automatically logs to credit_transactions, deducting from 444 billion pool
DROP FUNCTION IF EXISTS public.award_credits(TEXT, INTEGER, TEXT, TEXT, JSONB);

CREATE FUNCTION public.award_credits(
  p_clerk_user_id TEXT,
  p_amount INTEGER,
  p_type TEXT, -- 'code_claim', 'credit_award', 'earn_revenue', 'quest_reward', etc.
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE(
  success BOOLEAN,
  new_credits INTEGER,
  new_balance_total INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits INTEGER;
  v_new_credits INTEGER;
  v_free_credits INTEGER;
  v_total INTEGER;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, 0, 0, 'Credit amount must be positive'::TEXT;
    RETURN;
  END IF;

  -- Fetch current state
  SELECT credits, free_credits
  INTO v_credits, v_free_credits
  FROM public.users
  WHERE clerk_user_id = p_clerk_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 'User not found'::TEXT;
    RETURN;
  END IF;

  v_credits := COALESCE(v_credits, 0);
  v_free_credits := COALESCE(v_free_credits, 0);
  v_new_credits := v_credits + p_amount;
  v_total := v_new_credits + v_free_credits;

  -- Update paid credits (NOT free credits - those use award_free_credits)
  UPDATE public.users
  SET credits = v_new_credits,
      updated_at = NOW()
  WHERE clerk_user_id = p_clerk_user_id;

  -- MANDATORY: Log to credit_transactions (deducts from 444B pool)
  BEGIN
    INSERT INTO public.credit_transactions (
      user_id,
      amount,
      balance_after,
      type,
      status,
      description,
      metadata
    ) VALUES (
      p_clerk_user_id,
      p_amount,
      v_new_credits,
      p_type,
      'success',
      COALESCE(p_description, 'Credit award'),
      p_metadata || jsonb_build_object(
        'source', 'award_credits_rpc',
        'previous_credits', v_credits,
        'awarded_amount', p_amount,
        'tracked_in_444b_pool', true
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- If logging fails, ROLLBACK the credit award
    RAISE EXCEPTION 'award_credits: Failed to log transaction (rolled back): %', SQLERRM;
  END;

  RETURN QUERY SELECT true, v_new_credits, v_total, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_credits(TEXT, INTEGER, TEXT, TEXT, JSONB)
  TO anon, authenticated, service_role;

-- ── 2. Admin notification system ──────────────────────────────────────────
-- Stores system-level notifications for admin dashboard
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info', -- 'info', 'success', 'warning', 'critical'
  category TEXT DEFAULT 'general', -- 'credits', 'users', 'revenue', 'system'
  is_read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread 
  ON public.admin_notifications(is_read, created_at DESC) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_admin_notifications_category 
  ON public.admin_notifications(category, created_at DESC);

-- ── 3. Trigger audit function for untracked credits ──────────────────────
-- Detects if credits are updated without corresponding transaction log
CREATE OR REPLACE FUNCTION public.audit_credit_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_diff INTEGER;
  v_recent_txn BOOLEAN;
BEGIN
  -- Only check if credits increased
  IF NEW.credits > OLD.credits THEN
    v_diff := NEW.credits - OLD.credits;
    
    -- Check if there's a corresponding transaction within last 5 seconds
    SELECT EXISTS (
      SELECT 1 FROM public.credit_transactions
      WHERE user_id = NEW.clerk_user_id
        AND amount = v_diff
        AND created_at > (NOW() - INTERVAL '5 seconds')
    ) INTO v_recent_txn;
    
    -- If no transaction found, log warning to admin
    IF NOT v_recent_txn THEN
      INSERT INTO public.admin_notifications (
        title,
        message,
        type,
        category,
        metadata
      ) VALUES (
        '⚠️ Untracked Credit Addition Detected',
        format('User %s received +%s credits without transaction log', 
          NEW.username, v_diff),
        'warning',
        'credits',
        jsonb_build_object(
          'user_id', NEW.clerk_user_id,
          'username', NEW.username,
          'credits_added', v_diff,
          'old_balance', OLD.credits,
          'new_balance', NEW.credits,
          'detected_at', NOW()
        )
      );
      
      RAISE WARNING 'Untracked credit addition: User % (+% credits)', 
        NEW.clerk_user_id, v_diff;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS audit_credit_changes_trigger ON public.users;

-- Create trigger (runs AFTER update to avoid interfering with transactions)
CREATE TRIGGER audit_credit_changes_trigger
AFTER UPDATE OF credits ON public.users
FOR EACH ROW
WHEN (NEW.credits <> OLD.credits AND NEW.credits > OLD.credits)
EXECUTE FUNCTION public.audit_credit_changes();

-- ── 4. Admin notification helper function ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_admin(
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_category TEXT DEFAULT 'general',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_notifications (
    title, message, type, category, metadata
  ) VALUES (
    p_title, p_message, p_type, p_category, p_metadata
  );
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_admin failed: %', SQLERRM;
  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_admin(TEXT, TEXT, TEXT, TEXT, JSONB)
  TO anon, authenticated, service_role;

-- ── 5. Credit audit query (run anytime to verify) ─────────────────────────
-- This query detects credits that weren't properly tracked
CREATE OR REPLACE FUNCTION public.audit_untracked_credits()
RETURNS TABLE(
  total_credits_in_system INTEGER,
  total_credits_awarded_logged INTEGER,
  total_credits_spent_logged INTEGER,
  net_from_transactions INTEGER,
  untracked_credit_delta INTEGER,
  audit_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_in_system INTEGER;
  v_total_awarded INTEGER;
  v_total_spent INTEGER;
  v_net INTEGER;
  v_delta INTEGER;
BEGIN
  -- Sum all credits currently in user accounts (including free_credits)
  SELECT COALESCE(SUM(COALESCE(credits, 0) + COALESCE(free_credits, 0)), 0)
  INTO v_total_in_system
  FROM public.users;
  
  -- Sum all credit additions from logs (positive amounts)
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_awarded
  FROM public.credit_transactions
  WHERE amount > 0 AND status = 'success';
  
  -- Sum all credit deductions from logs (negative amounts)
  SELECT COALESCE(ABS(SUM(amount)), 0)
  INTO v_total_spent
  FROM public.credit_transactions
  WHERE amount < 0 AND status = 'success';
  
  v_net := v_total_awarded - v_total_spent;
  v_delta := v_total_in_system - v_net;
  
  RETURN QUERY SELECT 
    v_total_in_system,
    v_total_awarded,
    v_total_spent,
    v_net,
    v_delta,
    CASE 
      WHEN v_delta = 0 THEN '✅ All credits tracked'
      WHEN v_delta > 0 THEN format('⚠️ %s untracked credits detected', v_delta)
      ELSE format('❌ Negative delta (%s) - data integrity issue', v_delta)
    END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.audit_untracked_credits()
  TO anon, authenticated, service_role;

-- ── 6. Comprehensive audit view ───────────────────────────────────────────
CREATE OR REPLACE VIEW public.credit_audit_summary AS
SELECT
  (SELECT COUNT(*) FROM public.users) as total_users,
  (SELECT COALESCE(SUM(COALESCE(credits, 0) + COALESCE(free_credits, 0)), 0) FROM public.users) as total_credits_in_system,
  (SELECT COALESCE(SUM(COALESCE(free_credits, 0)), 0) FROM public.users) as total_free_credits,
  (SELECT COALESCE(SUM(COALESCE(credits, 0)), 0) FROM public.users) as total_paid_credits,
  (SELECT COUNT(*) FROM public.credit_transactions WHERE amount > 0) as total_credit_awards,
  (SELECT COALESCE(SUM(amount), 0) FROM public.credit_transactions WHERE amount > 0 AND status = 'success') as total_credits_awarded,
  (SELECT COUNT(*) FROM public.credit_transactions WHERE amount < 0) as total_credit_deductions,
  (SELECT COALESCE(ABS(SUM(amount)), 0) FROM public.credit_transactions WHERE amount < 0 AND status = 'success') as total_credits_spent,
  444000000000 as admin_allocation_total,
  (444000000000 - (SELECT COALESCE(SUM(amount), 0) FROM public.credit_transactions WHERE amount > 0 AND status = 'success')) as admin_remaining,
  NOW() as audit_timestamp;

GRANT SELECT ON public.credit_audit_summary TO anon, authenticated, service_role;

-- ── 7. Comments ───────────────────────────────────────────────────────────
COMMENT ON FUNCTION public.award_credits IS 'Centralized credit award function - ALWAYS logs to credit_transactions, deducting from 444B admin pool';
COMMENT ON FUNCTION public.award_free_credits IS 'Awards free credits (from codes) - bypasses $1 wallet gate';
COMMENT ON FUNCTION public.audit_untracked_credits IS 'Detects credits that were added without proper transaction logging';
COMMENT ON FUNCTION public.notify_admin IS 'Sends notification to admin dashboard';
COMMENT ON TABLE public.admin_notifications IS 'System notifications for admin dashboard - credit alerts, user warnings, etc.';
COMMENT ON VIEW public.credit_audit_summary IS 'Real-time credit system audit summary';
COMMENT ON TRIGGER audit_credit_changes_trigger ON public.users IS 'Detects and logs untracked credit additions';
