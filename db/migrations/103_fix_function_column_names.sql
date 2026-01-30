-- ============================================================================
-- FIX FUNCTION COLUMN REFERENCES
-- Change id::TEXT to clerk_user_id in credit functions
-- Date: 2026-01-30
-- ============================================================================

-- Recreate deduct_generation_credit with correct column
DROP FUNCTION IF EXISTS public.deduct_generation_credit(TEXT);

CREATE FUNCTION public.deduct_generation_credit(user_id_param TEXT)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  UPDATE public.users 
  SET credits = GREATEST(credits - 1, 0), 
      total_generated = total_generated + 1 
  WHERE clerk_user_id = user_id_param;
  
  RETURN FOUND;
END;
$$;

-- Recreate add_signup_credits with correct column
DROP FUNCTION IF EXISTS public.add_signup_credits(TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.add_signup_credits(TEXT);

CREATE FUNCTION public.add_signup_credits(user_id_param TEXT, credit_amount INTEGER DEFAULT 20)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  UPDATE public.users 
  SET credits = credits + credit_amount 
  WHERE clerk_user_id = user_id_param;
  
  RETURN FOUND;
END;
$$;

-- ============================================================================
-- COMPLETED - FUNCTIONS NOW USE clerk_user_id COLUMN
-- ============================================================================
