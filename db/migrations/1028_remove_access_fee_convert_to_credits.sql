-- Migration 1028: Remove $1 access fee — convert ALL wallet to credits
--
-- Changes:
--   1. convert_wallet_to_credits() now converts ALL wallet balance (no $1 lock).
--   2. One-time: auto-convert the previously-locked $1 into credits for all
--      existing users who had exactly $1 stuck in their wallet.
--
-- The $1 access fee concept is fully retired. Credits are the only gate.

-- ── 1. Update convert_wallet_to_credits() — no $1 lock ──────────────────
DROP FUNCTION IF EXISTS public.convert_wallet_to_credits(TEXT, NUMERIC);
CREATE OR REPLACE FUNCTION public.convert_wallet_to_credits(
  p_clerk_user_id TEXT,
  p_amount_usd NUMERIC DEFAULT NULL
)
RETURNS TABLE(
  success           BOOLEAN,
  credits_added     INTEGER,
  new_wallet_balance NUMERIC,
  new_credits       INTEGER,
  amount_converted  NUMERIC,
  error_message     TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet       NUMERIC;
  v_credits      INTEGER;
  v_convert      NUMERIC;
  v_add          INTEGER;
  v_new_wallet   NUMERIC;
  v_new_credits  INTEGER;
  v_rate  CONSTANT NUMERIC := 0.035;
BEGIN
  SELECT wallet_balance, credits
  INTO v_wallet, v_credits
  FROM public.users
  WHERE clerk_user_id = p_clerk_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0.00::NUMERIC, 0, 0.00::NUMERIC, 'User not found'::TEXT;
    RETURN;
  END IF;

  v_wallet  := COALESCE(v_wallet, 0.00);
  v_credits := COALESCE(v_credits, 0);

  IF v_wallet <= 0 THEN
    RETURN QUERY SELECT false, 0, v_wallet, v_credits, 0.00::NUMERIC,
      'No wallet balance to convert'::TEXT;
    RETURN;
  END IF;

  -- Determine how much to convert (ALL available, no $1 lock)
  IF p_amount_usd IS NULL OR p_amount_usd > v_wallet THEN
    v_convert := v_wallet;
  ELSIF p_amount_usd <= 0 THEN
    RETURN QUERY SELECT false, 0, v_wallet, v_credits, 0.00::NUMERIC, 'Invalid amount'::TEXT;
    RETURN;
  ELSE
    v_convert := p_amount_usd;
  END IF;

  v_add := FLOOR(v_convert / v_rate)::INTEGER;

  IF v_add <= 0 THEN
    RETURN QUERY SELECT false, 0, v_wallet, v_credits, 0.00::NUMERIC,
      'Amount too small to convert'::TEXT;
    RETURN;
  END IF;

  v_new_wallet  := v_wallet - v_convert;
  v_new_credits := v_credits + v_add;

  UPDATE public.users
  SET wallet_balance = v_new_wallet,
      credits        = v_new_credits,
      updated_at     = NOW()
  WHERE clerk_user_id = p_clerk_user_id;

  -- Audit log
  BEGIN
    INSERT INTO public.credit_transactions (
      user_id, amount, balance_after, type, status, description, metadata
    ) VALUES (
      p_clerk_user_id,
      v_add,
      v_new_credits,
      'wallet_conversion',
      'success',
      'Converted $' || TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM v_convert::TEXT))
        || ' → ' || v_add || ' credits',
      jsonb_build_object(
        'source',           'atomic',
        'usd_converted',    v_convert,
        'credits_added',    v_add,
        'rate_per_credit',  v_rate,
        'locked_amount',    0,
        'previous_wallet',  v_wallet,
        'new_wallet',       v_new_wallet,
        'previous_credits', v_credits
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'convert_wallet_to_credits: log failed: %', SQLERRM;
  END;

  RETURN QUERY SELECT true, v_add, v_new_wallet, v_new_credits, v_convert, NULL::TEXT;
END;
$$;

-- ── 2. One-time: convert the locked $1 for existing users ────────────────
-- Users who had exactly ~$1.00 stuck in wallet get it converted to 28 credits
DO $$
DECLARE
  r RECORD;
  v_credits_to_add INTEGER;
BEGIN
  FOR r IN
    SELECT clerk_user_id, wallet_balance, credits
    FROM public.users
    WHERE wallet_balance > 0
      AND wallet_balance <= 1.01   -- had $1 locked (with float tolerance)
  LOOP
    v_credits_to_add := FLOOR(r.wallet_balance / 0.035)::INTEGER;
    IF v_credits_to_add > 0 THEN
      UPDATE public.users
      SET credits = COALESCE(credits, 0) + v_credits_to_add,
          wallet_balance = 0,
          updated_at = NOW()
      WHERE clerk_user_id = r.clerk_user_id;

      BEGIN
        INSERT INTO public.credit_transactions (
          user_id, amount, balance_after, type, status, description, metadata
        ) VALUES (
          r.clerk_user_id,
          v_credits_to_add,
          COALESCE(r.credits, 0) + v_credits_to_add,
          'wallet_conversion',
          'success',
          'Access fee refund: $' || TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM r.wallet_balance::TEXT))
            || ' → ' || v_credits_to_add || ' credits (access fee removed)',
          jsonb_build_object(
            'source', 'access_fee_refund',
            'usd_converted', r.wallet_balance,
            'credits_added', v_credits_to_add,
            'previous_wallet', r.wallet_balance,
            'previous_credits', r.credits
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'access_fee_refund log failed for %: %', r.clerk_user_id, SQLERRM;
      END;

      RAISE NOTICE 'Refunded $% → % credits for user %', r.wallet_balance, v_credits_to_add, r.clerk_user_id;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================================
-- END 1028
-- ============================================================================
