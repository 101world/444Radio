-- Migration 129: Fix deduct_credits to reject negative/zero amounts
-- Vulnerability: passing p_amount <= 0 would ADD credits instead of deducting.
-- Also adds a CHECK constraint on p_amount.

DROP FUNCTION IF EXISTS public.deduct_credits(TEXT, INTEGER, TEXT, TEXT, JSONB);

CREATE FUNCTION public.deduct_credits(
  p_clerk_user_id TEXT,
  p_amount INTEGER,
  p_type TEXT DEFAULT 'deduction',
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE(success BOOLEAN, new_credits INTEGER, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits       INTEGER;
  v_wallet        NUMERIC;
  v_new_credits   INTEGER;
  v_final_meta    JSONB;
  v_min_wallet CONSTANT NUMERIC := 1.00;
BEGIN
  -- ── AMOUNT VALIDATION (prevents negative amounts adding credits) ──
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, 0, 'Invalid amount: must be positive'::TEXT;
    RETURN;
  END IF;

  SELECT credits, wallet_balance
  INTO v_credits, v_wallet
  FROM public.users
  WHERE clerk_user_id = p_clerk_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'User not found'::TEXT;
    RETURN;
  END IF;

  -- ── $1 ACCESS GATE ──
  IF COALESCE(v_wallet, 0) < v_min_wallet THEN
    RETURN QUERY SELECT false, COALESCE(v_credits, 0),
      'Wallet balance below $1.00. Add funds to continue generating.'::TEXT;
    RETURN;
  END IF;

  -- ── Credit check ──
  IF v_credits < p_amount THEN
    RETURN QUERY SELECT false, v_credits, 'Insufficient credits'::TEXT;
    RETURN;
  END IF;

  v_new_credits := v_credits - p_amount;

  UPDATE public.users
  SET credits = v_new_credits,
      total_generated = total_generated + 1
  WHERE clerk_user_id = p_clerk_user_id;

  -- Atomic audit log
  v_final_meta := COALESCE(p_metadata, '{}'::JSONB) || '{"source": "atomic"}'::JSONB;

  BEGIN
    INSERT INTO public.credit_transactions (
      user_id, amount, balance_after, type, status, description, metadata
    ) VALUES (
      p_clerk_user_id,
      -p_amount,
      v_new_credits,
      p_type,
      'success',
      COALESCE(p_description, 'Credit deduction'),
      v_final_meta
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'deduct_credits: log failed: %', SQLERRM;
  END;

  RETURN QUERY SELECT true, v_new_credits, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_credits(TEXT, INTEGER, TEXT, TEXT, JSONB)
  TO anon, authenticated, service_role;
