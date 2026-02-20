-- ============================================================================
-- 132: BULLETPROOF CREDIT TRACKING SYSTEM (FIXED)
-- 
-- Fixes: Drops ALL versions of notify_admin to avoid signature conflicts
-- ============================================================================

-- ── 1. Centralized award_credits() RPC ────────────────────────────────────
DROP FUNCTION IF EXISTS public.award_credits(TEXT, INTEGER, TEXT, TEXT, JSONB);

CREATE FUNCTION public.award_credits(
  p_clerk_user_id TEXT,
  p_amount INTEGER,
  p_type TEXT,
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
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, 0, 0, 'Credit amount must be positive'::TEXT;
    RETURN;
  END IF;

  SELECT credits, free_credits INTO v_credits, v_free_credits
  FROM public.users WHERE clerk_user_id = p_clerk_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.users (clerk_user_id, credits, free_credits, created_at, updated_at)
    VALUES (p_clerk_user_id, 0, 0, NOW(), NOW());
    v_credits := 0;
    v_free_credits := 0;
  END IF;

  v_new_credits := v_credits + p_amount;
  v_total := v_new_credits + COALESCE(v_free_credits, 0);

  UPDATE public.users SET credits = v_new_credits, updated_at = NOW()
  WHERE clerk_user_id = p_clerk_user_id;

  BEGIN
    INSERT INTO public.credit_transactions (user_id, amount, balance_after, type, status, description, metadata)
    VALUES (p_clerk_user_id, p_amount, v_total, p_type, 'success', COALESCE(p_description, 'Credit award'), p_metadata);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Transaction logging failed for user %. Credits NOT awarded. Error: %', p_clerk_user_id, SQLERRM;
  END;

  RETURN QUERY SELECT true, v_new_credits, v_total, NULL::TEXT;
END;
$$;

-- ── 2. Admin Notifications Table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT DEFAULT 'system',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read ON public.admin_notifications(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_admin_notifications_category ON public.admin_notifications(category);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created ON public.admin_notifications(created_at DESC);

-- ── 3. notify_admin() Helper (DROP ALL VERSIONS FIRST) ────────────────────
-- Drop all existing versions to avoid "function name is not unique" error
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT oid::regprocedure 
    FROM pg_proc 
    WHERE proname = 'notify_admin' 
      AND pg_function_is_visible(oid)
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.oid::regprocedure || ' CASCADE';
    RAISE NOTICE 'Dropped function: %', r.oid::regprocedure;
  END LOOP;
END;
$$;

-- Now create the single correct version
CREATE FUNCTION public.notify_admin(
  p_title TEXT,
  p_message TEXT,
  p_category TEXT DEFAULT 'system',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id BIGINT;
BEGIN
  INSERT INTO public.admin_notifications (title, message, category, metadata)
  VALUES (p_title, p_message, p_category, p_metadata)
  RETURNING id INTO v_notification_id;
  RETURN v_notification_id;
END;
$$;

-- ── 4. Audit Trigger (Detects Untracked Credits) ──────────────────────────
DROP FUNCTION IF EXISTS public.audit_credit_changes() CASCADE;

CREATE FUNCTION public.audit_credit_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_diff INTEGER;
  v_free_credit_diff INTEGER;
  v_transaction_exists BOOLEAN;
BEGIN
  v_credit_diff := NEW.credits - OLD.credits;
  v_free_credit_diff := COALESCE(NEW.free_credits, 0) - COALESCE(OLD.free_credits, 0);
  
  IF v_credit_diff > 0 OR v_free_credit_diff > 0 THEN
    SELECT EXISTS (
      SELECT 1 FROM public.credit_transactions
      WHERE user_id = NEW.clerk_user_id
        AND created_at > NOW() - INTERVAL '5 seconds'
        AND amount = GREATEST(v_credit_diff, v_free_credit_diff)
    ) INTO v_transaction_exists;
    
    IF NOT v_transaction_exists THEN
      PERFORM notify_admin(
        '⚠️ Untracked Credit Addition',
        format('User %s: +%s credits, +%s free credits (no transaction)', NEW.clerk_user_id, v_credit_diff, v_free_credit_diff),
        'warning',
        jsonb_build_object('user_id', NEW.clerk_user_id, 'credits_added', v_credit_diff, 'free_credits_added', v_free_credit_diff)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_credit_changes_trigger ON public.users;
CREATE TRIGGER audit_credit_changes_trigger
  AFTER UPDATE OF credits, free_credits ON public.users
  FOR EACH ROW
  WHEN (NEW.credits > OLD.credits OR COALESCE(NEW.free_credits, 0) > COALESCE(OLD.free_credits, 0))
  EXECUTE FUNCTION audit_credit_changes();

-- ── 5. Reconciliation Function ────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.audit_untracked_credits();

CREATE FUNCTION public.audit_untracked_credits()
RETURNS TABLE(
  clerk_user_id TEXT,
  current_credits INTEGER,
  current_free_credits INTEGER,
  total_credits INTEGER,
  logged_transactions BIGINT,
  transaction_sum BIGINT,
  discrepancy BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.clerk_user_id,
    u.credits,
    COALESCE(u.free_credits, 0) as free_credits,
    u.credits + COALESCE(u.free_credits, 0) as total,
    COUNT(ct.id) as logged_transactions,
    COALESCE(SUM(ct.amount), 0) as transaction_sum,
    (u.credits + COALESCE(u.free_credits, 0)) - COALESCE(SUM(ct.amount), 0) as discrepancy
  FROM public.users u
  LEFT JOIN public.credit_transactions ct ON ct.user_id = u.clerk_user_id
  WHERE u.credits > 0 OR u.free_credits > 0
  GROUP BY u.clerk_user_id, u.credits, u.free_credits
  HAVING (u.credits + COALESCE(u.free_credits, 0)) != COALESCE(SUM(ct.amount), 0)
  ORDER BY discrepancy DESC;
END;
$$;

-- ── 6. Dashboard View ──────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.credit_audit_summary CASCADE;

CREATE VIEW public.credit_audit_summary AS
SELECT
  SUM(u.credits + COALESCE(u.free_credits, 0)) as total_user_credits,
  (SELECT COALESCE(SUM(amount), 0) FROM public.credit_transactions WHERE amount > 0) as total_logged_awards,
  444000000000 - (SELECT COALESCE(SUM(amount), 0) FROM public.credit_transactions WHERE amount > 0) as admin_pool_remaining,
  SUM(u.credits + COALESCE(u.free_credits, 0)) - (SELECT COALESCE(SUM(amount), 0) FROM public.credit_transactions WHERE amount > 0) as discrepancy,
  COUNT(DISTINCT u.clerk_user_id) as total_users_with_credits,
  SUM(u.credits) as total_paid_credits,
  SUM(COALESCE(u.free_credits, 0)) as total_free_credits
FROM public.users u
WHERE u.credits > 0 OR u.free_credits > 0;

-- ── 7. Comments ────────────────────────────────────────────────────────────
COMMENT ON FUNCTION public.award_credits IS 'Centralized function for awarding paid credits with automatic transaction logging';
COMMENT ON FUNCTION public.notify_admin IS 'Creates admin notification for system alerts (fixed signature)';
COMMENT ON FUNCTION public.audit_credit_changes IS 'Trigger function that detects untracked credit additions';
COMMENT ON FUNCTION public.audit_untracked_credits IS 'Finds users with credit discrepancies';
COMMENT ON VIEW public.credit_audit_summary IS 'Real-time dashboard of credit system health';
COMMENT ON TABLE public.admin_notifications IS 'System notifications for admin dashboard';

-- Verification
SELECT routine_name, routine_schema 
FROM information_schema.routines 
WHERE routine_name IN ('award_credits', 'notify_admin', 'audit_untracked_credits')
  AND routine_schema = 'public';
