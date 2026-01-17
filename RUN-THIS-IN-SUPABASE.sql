-- Run this in Supabase SQL Editor manually
-- Creates atomic credit deduction to prevent race conditions

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
  
  -- Check if enough credits
  IF v_current_credits < p_amount THEN
    RETURN QUERY SELECT FALSE, v_current_credits, 'Insufficient credits';
    RETURN;
  END IF;
  
  -- Deduct credits
  v_new_credits := v_current_credits - p_amount;
  
  UPDATE users
  SET credits = v_new_credits,
      total_generated = COALESCE(total_generated, 0) + 1
  WHERE clerk_user_id = p_clerk_user_id;
  
  -- Return success
  RETURN QUERY SELECT TRUE, v_new_credits, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Test it
SELECT * FROM deduct_credits('your_clerk_user_id', 2);
