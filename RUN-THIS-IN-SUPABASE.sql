-- Run this in Supabase SQL Editor manually
-- Creates atomic credit deduction to prevent race conditions
-- Supports both deduction (positive amount) and refund (negative amount)

CREATE OR REPLACE FUNCTION deduct_credits(
  p_clerk_user_id TEXT,
  p_amount INTEGER
)
RETURNS TABLE (
  success BOOLEAN,
  new_credits INTEGER,
  error_message TEXT
) AS $$
DECLARE
  v_current_credits INTEGER;
  v_new_credits INTEGER;
BEGIN
  -- Lock the row for update (prevents concurrent modifications)
  SELECT credits INTO v_current_credits
  FROM users
  WHERE clerk_user_id = p_clerk_user_id
  FOR UPDATE;
  
  -- Check if user exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'User not found';
    RETURN;
  END IF;
  
  -- For deductions (positive amount): check if enough credits
  IF p_amount > 0 AND v_current_credits < p_amount THEN
    RETURN QUERY SELECT FALSE, v_current_credits, 'Insufficient credits';
    RETURN;
  END IF;
  
  -- Calculate new credits (subtract for deduction, add for refund)
  v_new_credits := v_current_credits - p_amount;
  
  -- Ensure credits never go negative
  IF v_new_credits < 0 THEN
    v_new_credits := 0;
  END IF;
  
  -- Update credits and increment total_generated only for deductions
  IF p_amount > 0 THEN
    UPDATE users
    SET credits = v_new_credits,
        total_generated = COALESCE(total_generated, 0) + 1
    WHERE clerk_user_id = p_clerk_user_id;
  ELSE
    -- For refunds, only update credits
    UPDATE users
    SET credits = v_new_credits
    WHERE clerk_user_id = p_clerk_user_id;
  END IF;
  
  -- Return success
  RETURN QUERY SELECT TRUE, v_new_credits, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Test it
SELECT * FROM deduct_credits('your_clerk_user_id', 2);
