-- ============================================================================
-- FIX DEDUCT_CREDITS RACE CONDITION
-- Previous version didn't use FOR UPDATE row lock, allowing concurrent calls
-- to both read the same balance and double-deduct.
-- This version uses SELECT ... FOR UPDATE to serialize concurrent deductions.
-- Date: 2026-02-12
-- ============================================================================

DROP FUNCTION IF EXISTS public.deduct_credits(TEXT, INTEGER);

CREATE FUNCTION public.deduct_credits(p_clerk_user_id TEXT, p_amount INTEGER)
RETURNS TABLE(success BOOLEAN, new_credits INTEGER, error_message TEXT)
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_current_credits INTEGER;
  v_new_credits INTEGER;
BEGIN
  -- Lock the row to prevent concurrent deductions (FOR UPDATE)
  SELECT credits INTO v_current_credits
  FROM public.users
  WHERE clerk_user_id = p_clerk_user_id
  FOR UPDATE;
  
  -- Check if user exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'User not found'::TEXT;
    RETURN;
  END IF;
  
  -- Check if enough credits
  IF v_current_credits < p_amount THEN
    RETURN QUERY SELECT false, v_current_credits, 'Insufficient credits'::TEXT;
    RETURN;
  END IF;
  
  -- Deduct credits (already holding row lock, safe from concurrent access)
  v_new_credits := v_current_credits - p_amount;
  
  UPDATE public.users 
  SET credits = v_new_credits,
      total_generated = total_generated + 1
  WHERE clerk_user_id = p_clerk_user_id;
  
  -- Return success
  RETURN QUERY SELECT true, v_new_credits, NULL::TEXT;
END;
$$;

-- ============================================================================
-- END FIX
-- ============================================================================
