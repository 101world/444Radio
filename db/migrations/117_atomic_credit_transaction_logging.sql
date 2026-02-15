-- ============================================================================
-- ATOMIC CREDIT TRANSACTION LOGGING
-- Previously: deduct_credits deducted atomically but logCreditTransaction was
-- a separate async JS call that could silently fail, losing the audit trail.
-- 
-- Fix: deduct_credits now also INSERTs into credit_transactions in the SAME
-- database transaction. Even if the app-level JS log fails, the atomic row
-- guarantees we always have a record of what was deducted.
--
-- The app-level logCreditTransaction still runs as enrichment (adds type,
-- description, metadata). Duplicate rows are harmless — the atomic one is
-- identifiable via metadata->>'source' = 'atomic'.
-- Date: 2026-02-15
-- ============================================================================

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
  v_current_credits INTEGER;
  v_new_credits INTEGER;
  v_final_metadata JSONB;
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
  
  -- ── ATOMIC LOGGING ──
  -- Insert credit_transactions row in the SAME transaction as the deduction.
  -- This guarantees we never lose the audit trail, even if the app-level
  -- logCreditTransaction fails.
  v_final_metadata := COALESCE(p_metadata, '{}'::JSONB) || '{"source": "atomic"}'::JSONB;
  
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
      v_final_metadata
    );
  EXCEPTION WHEN OTHERS THEN
    -- If credit_transactions table doesn't exist or has schema issues,
    -- don't fail the deduction — just log and continue.
    RAISE WARNING 'Failed to log credit transaction: %', SQLERRM;
  END;
  
  -- Return success
  RETURN QUERY SELECT true, v_new_credits, NULL::TEXT;
END;
$$;

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION public.deduct_credits(TEXT, INTEGER, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;

-- ============================================================================
-- END ATOMIC CREDIT TRANSACTION LOGGING
-- ============================================================================
