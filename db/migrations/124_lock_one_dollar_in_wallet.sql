-- ============================================================================
-- 124: Lock $1 in Wallet — Cannot Be Converted to Credits
--
-- The first $1 deposited acts as an "access fee" and must remain in the
-- wallet permanently. Users can only convert amounts ABOVE $1 to credits.
--
-- This reverts migration 123's "convert all" behavior back to migration 119's
-- $1 retention, but keeps the p_amount_usd partial-conversion support.
--
-- Examples:
--   - Wallet $1.00 → convertible: $0.00 (locked)
--   - Wallet $2.00 → convertible: $1.00 (28 credits)
--   - Wallet $5.00 → convertible: $4.00 (114 credits)
--   - Wallet $10.00 → convertible: $9.00 (257 credits)
--
-- Date: 2026-02-16
-- ============================================================================

CREATE OR REPLACE FUNCTION public.convert_wallet_to_credits(
  p_clerk_user_id TEXT,
  p_amount_usd NUMERIC DEFAULT NULL
)
RETURNS TABLE(
  success           BOOLEAN,
  credits_added     INTEGER,
  new_wallet_balance NUMERIC,
  new_credits       INTEGER,
  error_message     TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet       NUMERIC;
  v_credits      INTEGER;
  v_available    NUMERIC;
  v_convert      NUMERIC;
  v_add          INTEGER;
  v_new_wallet   NUMERIC;
  v_new_credits  INTEGER;
  v_rate  CONSTANT NUMERIC := 0.035;
  v_min   CONSTANT NUMERIC := 1.00;   -- $1 is LOCKED, never convertible
BEGIN
  SELECT wallet_balance, credits
  INTO v_wallet, v_credits
  FROM public.users
  WHERE clerk_user_id = p_clerk_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0.00::NUMERIC, 0, 'User not found'::TEXT;
    RETURN;
  END IF;

  v_wallet  := COALESCE(v_wallet, 0.00);
  v_credits := COALESCE(v_credits, 0);

  -- Only the amount ABOVE $1 is convertible
  v_available := v_wallet - v_min;

  IF v_available <= 0 THEN
    RETURN QUERY SELECT false, 0, v_wallet, v_credits,
      ('$1.00 is locked in your wallet as an access fee. You need more than $1 to convert. Current balance: $' || v_wallet::TEXT)::TEXT;
    RETURN;
  END IF;

  -- Determine how much to convert (capped to available)
  IF p_amount_usd IS NULL OR p_amount_usd > v_available THEN
    v_convert := v_available;  -- Convert everything above $1
  ELSIF p_amount_usd <= 0 THEN
    RETURN QUERY SELECT false, 0, v_wallet, v_credits, 'Invalid amount'::TEXT;
    RETURN;
  ELSE
    v_convert := p_amount_usd;
  END IF;

  v_add := FLOOR(v_convert / v_rate)::INTEGER;

  IF v_add <= 0 THEN
    RETURN QUERY SELECT false, 0, v_wallet, v_credits, 'Amount too small to convert'::TEXT;
    RETURN;
  END IF;

  v_new_wallet  := v_wallet - v_convert;
  v_new_credits := v_credits + v_add;

  UPDATE public.users
  SET wallet_balance = v_new_wallet,
      credits        = v_new_credits,
      updated_at     = NOW()
  WHERE clerk_user_id = p_clerk_user_id;

  -- Atomic audit log
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
        'locked_amount',    v_min,
        'previous_wallet',  v_wallet,
        'new_wallet',       v_new_wallet,
        'previous_credits', v_credits
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'convert_wallet_to_credits: log failed: %', SQLERRM;
  END;

  RETURN QUERY SELECT true, v_add, v_new_wallet, v_new_credits, NULL::TEXT;
END;
$$;

-- ============================================================================
-- END 124
-- ============================================================================
