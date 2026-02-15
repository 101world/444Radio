-- ============================================================================
-- 120: REMOVE $1 WALLET GATE FROM deduct_credits + FIX GST HANDLING
--
-- Problem 1: deduct_credits() blocks users who have credits but $0 wallet.
--            Existing subscribers/users have credits but wallet_balance=0.
--            The $1 gate should only apply to WALLET CONVERSIONS, not to
--            spending already-converted credits.
--            Fix: Remove wallet gate from deduct_credits(). The gate stays
--            in convert_wallet_to_credits() where it belongs.
--
-- Problem 2: GST (18%) is charged on top of the deposit but the GST money
--            is not claimable — so the actual USD value deposited should be
--            the pre-GST amount (user pays GST as a tax, not as deposit).
--            This is already correct in the verify route (deposits deposit_usd
--            which is pre-GST). No DB change needed, only code-side.
--
-- Date: 2026-02-16
-- ============================================================================

-- ── Recreate deduct_credits WITHOUT wallet gate ──
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
  v_new_credits   INTEGER;
  v_final_meta    JSONB;
BEGIN
  SELECT credits
  INTO v_credits
  FROM public.users
  WHERE clerk_user_id = p_clerk_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'User not found'::TEXT;
    RETURN;
  END IF;

  -- ── Credit check only (no wallet gate) ──
  IF COALESCE(v_credits, 0) < p_amount THEN
    RETURN QUERY SELECT false, COALESCE(v_credits, 0), 'Insufficient credits'::TEXT;
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

-- ============================================================================
-- END 120
-- ============================================================================
