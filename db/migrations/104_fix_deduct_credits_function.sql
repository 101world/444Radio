-- ============================================================================
-- FIX DEDUCT_CREDITS FUNCTION - CRITICAL
-- This function is used by music generation and was still using id::TEXT
-- Date: 2026-01-30
-- ============================================================================

-- Recreate deduct_credits with correct column (clerk_user_id)
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
  -- Get current credits
  SELECT credits INTO v_current_credits
  FROM public.users
  WHERE clerk_user_id = p_clerk_user_id;
  
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
  
  -- Deduct credits
  v_new_credits := GREATEST(v_current_credits - p_amount, 0);
  
  UPDATE public.users 
  SET credits = v_new_credits,
      total_generated = total_generated + 1
  WHERE clerk_user_id = p_clerk_user_id;
  
  -- Return success
  RETURN QUERY SELECT true, v_new_credits, NULL::TEXT;
END;
$$;

-- ============================================================================
-- COMPLETED - deduct_credits NOW USES clerk_user_id
-- ============================================================================
