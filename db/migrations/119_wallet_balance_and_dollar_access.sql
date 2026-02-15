-- ============================================================================
-- 119: WALLET BALANCE + $1 ACCESS MODEL
--
-- New model: Users deposit dollars → wallet_balance → convert to credits.
-- $1.00 must always remain in wallet (access fee). No wallet balance = no
-- generations, even if credits > 0.
-- 1 credit = $0.035 USD.
-- Subscriptions fully removed — pay-per-usage only.
--
-- Changes:
--   1. Add wallet_balance column to users table
--   2. Create deposit_wallet() RPC — atomically adds dollars
--   3. Create convert_wallet_to_credits() RPC — converts $ to credits
--   4. Recreate deduct_credits() with $1 wallet gate
--
-- Date: 2026-02-16
-- ============================================================================

-- ── 1. Add wallet_balance column ──────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(10,2) DEFAULT 0.00;

-- ── 2. deposit_wallet() ──────────────────────────────────────────────────
-- Atomically adds dollars to wallet_balance.
-- Called by /api/credits/verify and razorpay webhook after payment.
CREATE OR REPLACE FUNCTION public.deposit_wallet(
  p_clerk_user_id TEXT,
  p_amount_usd NUMERIC
)
RETURNS TABLE(success BOOLEAN, new_balance NUMERIC, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current NUMERIC;
  v_new     NUMERIC;
BEGIN
  SELECT wallet_balance INTO v_current
  FROM public.users
  WHERE clerk_user_id = p_clerk_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0.00::NUMERIC, 'User not found'::TEXT;
    RETURN;
  END IF;

  IF p_amount_usd <= 0 THEN
    RETURN QUERY SELECT false, COALESCE(v_current, 0.00), 'Invalid deposit amount'::TEXT;
    RETURN;
  END IF;

  v_new := COALESCE(v_current, 0.00) + p_amount_usd;

  UPDATE public.users
  SET wallet_balance = v_new, updated_at = NOW()
  WHERE clerk_user_id = p_clerk_user_id;

  -- Atomic audit log
  BEGIN
    INSERT INTO public.credit_transactions (
      user_id, amount, balance_after, type, status, description, metadata
    ) VALUES (
      p_clerk_user_id,
      0,
      (SELECT credits FROM public.users WHERE clerk_user_id = p_clerk_user_id),
      'wallet_deposit',
      'success',
      'Wallet deposit: +$' || TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM p_amount_usd::TEXT)),
      jsonb_build_object(
        'source',                 'atomic',
        'deposit_usd',            p_amount_usd,
        'previous_wallet_balance', COALESCE(v_current, 0.00),
        'new_wallet_balance',     v_new
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'deposit_wallet: log failed: %', SQLERRM;
  END;

  RETURN QUERY SELECT true, v_new, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deposit_wallet(TEXT, NUMERIC)
  TO anon, authenticated, service_role;

-- ── 3. convert_wallet_to_credits() ───────────────────────────────────────
-- Converts wallet dollars → credits while keeping $1.00 minimum in wallet.
-- Rate: 1 credit = $0.035 USD  →  $1 buys 28 credits.
-- Pass NULL for p_amount_usd to convert ALL available.
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
  v_min   CONSTANT NUMERIC := 1.00;
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
  v_available := v_wallet - v_min;

  IF v_available <= 0 THEN
    RETURN QUERY SELECT false, 0, v_wallet, v_credits,
      ('Wallet balance must exceed $1.00. Current: $' || v_wallet::TEXT)::TEXT;
    RETURN;
  END IF;

  -- Determine how much to convert
  IF p_amount_usd IS NULL OR p_amount_usd > v_available THEN
    v_convert := v_available;
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

GRANT EXECUTE ON FUNCTION public.convert_wallet_to_credits(TEXT, NUMERIC)
  TO anon, authenticated, service_role;

-- ── 4. Recreate deduct_credits() WITH $1 wallet gate ─────────────────────
-- Same as migration 117, now also enforces wallet_balance >= $1.00.
DROP FUNCTION IF EXISTS public.deduct_credits(TEXT, INTEGER);
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

-- ============================================================================
-- END 119
-- ============================================================================
