-- Migration 1027: Remove $1 wallet gate from deduct_credits
--
-- The $1 access fee is being removed entirely.
-- Rule: Have credits → can generate. 0 credits → must buy more. That's it.
-- No wallet balance check at all.

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
  v_from_free      INTEGER;
  v_from_paid      INTEGER;
  v_new_free       INTEGER;
  v_new_paid       INTEGER;
  v_new_total      INTEGER;
  v_final_meta     JSONB;
BEGIN
  -- Lock user row
  SELECT credits, free_credits
  INTO v_credits, v_free_credits
  FROM public.users
  WHERE clerk_user_id = p_clerk_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'User not found'::TEXT;
    RETURN;
  END IF;

  v_credits      := COALESCE(v_credits, 0);
  v_free_credits := COALESCE(v_free_credits, 0);

  -- Check total covers the request
  IF (v_credits + v_free_credits) < p_amount THEN
    RETURN QUERY SELECT false, (v_credits + v_free_credits),
      'Insufficient credits'::TEXT;
    RETURN;
  END IF;

  -- PRIORITY 1: Consume free credits first
  IF v_free_credits > 0 THEN
    v_from_free := LEAST(v_free_credits, p_amount);
    v_new_free  := v_free_credits - v_from_free;
  ELSE
    v_from_free := 0;
    v_new_free  := 0;
  END IF;

  -- PRIORITY 2: Consume paid credits (NO wallet gate)
  v_from_paid := p_amount - v_from_free;

  IF v_from_paid > 0 THEN
    IF v_credits < v_from_paid THEN
      RETURN QUERY SELECT false, v_credits,
        'Insufficient paid credits'::TEXT;
      RETURN;
    END IF;
    v_new_paid := v_credits - v_from_paid;
  ELSE
    v_new_paid := v_credits;
  END IF;

  v_new_total := v_new_paid + v_new_free;

  -- Persist
  UPDATE public.users
  SET credits      = v_new_paid,
      free_credits = v_new_free,
      updated_at   = NOW()
  WHERE clerk_user_id = p_clerk_user_id;

  -- Audit metadata
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
