-- ============================================================================
-- 130: FREE THE MUSIC UPGRADE
--
-- Philosophy: New users can claim 44 free credits and generate WITHOUT
-- needing the $1 wallet deposit. Only when free credits are exhausted should
-- they hit the $1 access + pay-per-usage model.
--
-- Changes:
--   1. Add free_credits column to users table
--   2. Recreate deduct_credits() to prioritize free_credits FIRST
--   3. Update credit award tracking
--
-- Date: 2026-02-20
-- ============================================================================

-- ── 1. Add free_credits column ────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS free_credits INTEGER DEFAULT 0;

COMMENT ON COLUMN public.users.free_credits IS 'Credits from "FREE THE MUSIC" code - usable without $1 wallet gate';

-- ── 2. Recreate deduct_credits() WITH free_credits priority ───────────────
-- Logic:
--   1. Deduct from free_credits first (no wallet gate)
--   2. If free_credits exhausted, deduct from paid credits (requires $1 wallet)
--   3. Return clear error if wallet gate blocks paid credit usage
DROP FUNCTION IF EXISTS public.deduct_credits(TEXT, INTEGER);
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

  v_new_total := v_new_paid;

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

  -- Log transaction
  BEGIN
    INSERT INTO public.credit_transactions (
      user_id, amount, balance_after, type, status, description, metadata
    ) VALUES (
      p_clerk_user_id,
      -p_amount,
      v_new_total,
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

-- ── 3. Create function to award free credits ──────────────────────────────
CREATE OR REPLACE FUNCTION public.award_free_credits(
  p_clerk_user_id TEXT,
  p_amount INTEGER,
  p_description TEXT DEFAULT 'Free credits awarded',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE(success BOOLEAN, new_free_credits INTEGER, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_free INTEGER;
  v_new_free INTEGER;
BEGIN
  SELECT free_credits
  INTO v_current_free
  FROM public.users
  WHERE clerk_user_id = p_clerk_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'User not found'::TEXT;
    RETURN;
  END IF;

  v_current_free := COALESCE(v_current_free, 0);
  v_new_free := v_current_free + p_amount;

  UPDATE public.users
  SET free_credits = v_new_free,
      updated_at = NOW()
  WHERE clerk_user_id = p_clerk_user_id;

  -- Log transaction
  BEGIN
    INSERT INTO public.credit_transactions (
      user_id, amount, balance_after, type, status, description, metadata
    ) VALUES (
      p_clerk_user_id,
      p_amount,
      v_new_free,
      'code_claim',
      'success',
      p_description,
      p_metadata || jsonb_build_object('is_free_credits', true)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'award_free_credits: transaction log failed: %', SQLERRM;
  END;

  RETURN QUERY SELECT true, v_new_free, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_free_credits(TEXT, INTEGER, TEXT, JSONB)
  TO anon, authenticated, service_role;

-- ── 4. Index for performance ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_free_credits
  ON public.users(free_credits) WHERE free_credits > 0;

COMMENT ON TABLE public.users IS 'Users table with free_credits support for "Free the Music" initiative';
