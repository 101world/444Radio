-- ============================================================================
-- 133: FIX BALANCE_AFTER TO SHOW TOTAL CREDITS (PAID + FREE)
--
-- Problem: Transaction logs show ONLY paid credits in balance_after column
--          instead of total credits (paid + free)
--
-- This causes user wallet transaction history to display incorrect balances:
--   - deduct_credits() was logging v_new_paid (missing + v_new_free)
--   - award_credits() was logging v_new_credits (missing + v_free_credits)
--
-- Fix: Both functions now correctly log total credits (paid + free)
--
-- Date: 2026-02-20
-- ============================================================================

-- ── 1. Fix deduct_credits() ──────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.deduct_credits(TEXT, INTEGER, TEXT, TEXT, JSONB);

CREATE FUNCTION public.deduct_credits(
  p_clerk_user_id TEXT,
  p_amount INTEGER,
  p_type TEXT DEFAULT 'deduction',
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE(
  success BOOLEAN,
  new_credits INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits        INTEGER;
  v_free_credits   INTEGER;
  v_wallet         NUMERIC;
  v_min_wallet CONSTANT NUMERIC := 1.00;
  v_from_free      INTEGER;
  v_from_paid      INTEGER;
  v_new_free       INTEGER;
  v_new_paid       INTEGER;
  v_new_total      INTEGER;
  v_final_meta     JSONB;
BEGIN
  -- Fetch current state
  SELECT credits, free_credits, wallet_balance
  INTO v_credits, v_free_credits, v_wallet
  FROM public.users
  WHERE clerk_user_id = p_clerk_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'User not found'::TEXT;
    RETURN;
  END IF;

  v_credits := COALESCE(v_credits, 0);
  v_free_credits := COALESCE(v_free_credits, 0);
  v_wallet := COALESCE(v_wallet, 0.00);

  -- Total available credits
  IF (v_credits + v_free_credits) < p_amount THEN
    RETURN QUERY SELECT false, v_credits, 'Insufficient credits'::TEXT;
    RETURN;
  END IF;

  -- ── PRIORITY 1: Use free_credits first (NO WALLET GATE) ──
  IF v_free_credits > 0 THEN
    v_from_free := LEAST(v_free_credits, p_amount);
    v_new_free := v_free_credits - v_from_free;
  ELSE
    v_from_free := 0;
    v_new_free := 0;
  END IF;

  -- ── PRIORITY 2: Use paid credits (REQUIRES $1 WALLET) ──
  v_from_paid := p_amount - v_from_free;

  IF v_from_paid > 0 THEN
    -- Check wallet gate for paid credits
    IF v_wallet < v_min_wallet THEN
      RETURN QUERY SELECT false, v_credits,
        '$1 access required. Deposit $1 to unlock pay-per-usage. Visit /pricing to continue.'::TEXT;
      RETURN;
    END IF;

    -- Check sufficient paid credits
    IF v_credits < v_from_paid THEN
      RETURN QUERY SELECT false, v_credits,
        'Free credits exhausted. Deposit $1 for access + buy credits to continue.'::TEXT;
      RETURN;
    END IF;

    v_new_paid := v_credits - v_from_paid;
  ELSE
    v_new_paid := v_credits;
  END IF;

  -- ✅ FIX: Calculate total credits (paid + free) for accurate balance_after
  v_new_total := v_new_paid + v_new_free;

  -- Update user credits
  UPDATE public.users
  SET credits = v_new_paid,
      free_credits = v_new_free,
      updated_at = NOW()
  WHERE clerk_user_id = p_clerk_user_id;

  -- Build audit metadata
  v_final_meta := COALESCE(p_metadata, '{}'::JSONB) || jsonb_build_object(
    'from_free_credits', v_from_free,
    'from_paid_credits', v_from_paid,
    'remaining_free', v_new_free,
    'remaining_paid', v_new_paid
  );

  -- Log transaction with TOTAL credits (paid + free)
  BEGIN
    INSERT INTO public.credit_transactions (
      user_id, amount, balance_after, type, status, description, metadata
    ) VALUES (
      p_clerk_user_id,
      -p_amount,
      v_new_total,  -- ✅ NOW SHOWS TOTAL (paid + free) not just paid
      p_type,
      'success',
      COALESCE(p_description, 'Credit deduction'),
      v_final_meta
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'deduct_credits: transaction log failed: %', SQLERRM;
  END;

  RETURN QUERY SELECT true, v_new_total, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_credits(TEXT, INTEGER, TEXT, TEXT, JSONB)
  TO anon, authenticated, service_role;

-- ── 2. Fix award_credits() ───────────────────────────────────────────────
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

  -- MANDATORY: Log to credit_transactions with TOTAL credits (paid + free)
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
      v_total,  -- ✅ NOW SHOWS TOTAL (paid + free) not just paid
      p_type,
      'success',
      COALESCE(p_description, 'Credit award'),
      p_metadata || jsonb_build_object(
        'source', 'award_credits_rpc',
        'previous_credits', v_credits,
        'awarded_amount', p_amount,
        'tracked_in_444b_pool', true,
        'balance_paid', v_new_credits,
        'balance_free', v_free_credits,
        'balance_total', v_total
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

-- ── 3. Also fix award_free_credits() for consistency ──────────────────────
DROP FUNCTION IF EXISTS public.award_free_credits(TEXT, INTEGER, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.award_free_credits(
  p_clerk_user_id TEXT,
  p_amount INTEGER,
  p_description TEXT DEFAULT 'Free credits awarded',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE(success BOOLEAN, new_free_credits INTEGER, new_total_credits INTEGER, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_free INTEGER;
  v_current_paid INTEGER;
  v_new_free INTEGER;
  v_new_total INTEGER;
BEGIN
  SELECT free_credits, credits
  INTO v_current_free, v_current_paid
  FROM public.users
  WHERE clerk_user_id = p_clerk_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 'User not found'::TEXT;
    RETURN;
  END IF;

  v_current_free := COALESCE(v_current_free, 0);
  v_current_paid := COALESCE(v_current_paid, 0);
  v_new_free := v_current_free + p_amount;
  v_new_total := v_new_free + v_current_paid;

  UPDATE public.users
  SET free_credits = v_new_free,
      updated_at = NOW()
  WHERE clerk_user_id = p_clerk_user_id;

  -- Log transaction with TOTAL credits
  BEGIN
    INSERT INTO public.credit_transactions (
      user_id, amount, balance_after, type, status, description, metadata
    ) VALUES (
      p_clerk_user_id,
      p_amount,
      v_new_total,  -- ✅ TOTAL (paid + free) not just free
      'code_claim',
      'success',
      p_description,
      p_metadata || jsonb_build_object(
        'is_free_credits', true,
        'balance_paid', v_current_paid,
        'balance_free', v_new_free,
        'balance_total', v_new_total
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'award_free_credits: transaction log failed: %', SQLERRM;
  END;

  RETURN QUERY SELECT true, v_new_free, v_new_total, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_free_credits(TEXT, INTEGER, TEXT, JSONB)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.deduct_credits IS 'Deducts credits (free first, then paid). Logs balance_after as TOTAL (paid + free) credits.';
COMMENT ON FUNCTION public.award_credits IS 'Awards paid credits. Logs balance_after as TOTAL (paid + free) credits.';
COMMENT ON FUNCTION public.award_free_credits IS 'Awards free credits. Logs balance_after as TOTAL (paid + free) credits.';
