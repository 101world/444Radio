-- ============================================================================
-- ROLLBACK: Remove duplicate Free the Music credits
-- 
-- This will:
-- 1. Find users who got more than 24 credits from the upgrade
-- 2. Remove the excess credits
-- 3. Keep only the first 24 credits per user
-- ============================================================================

DO $$
DECLARE
  v_user_record RECORD;
  v_excess_credits INTEGER;
  v_current_free INTEGER;
BEGIN
  FOR v_user_record IN
    SELECT 
      user_id,
      SUM(amount) as total_received,
      COUNT(*) as times_awarded
    FROM credit_transactions
    WHERE description LIKE '%Free the Music%'
      AND metadata->>'campaign' = 'free_the_music'
    GROUP BY user_id
    HAVING SUM(amount) > 24
  LOOP
    v_excess_credits := v_user_record.total_received - 24;
    
    -- Get current free_credits
    SELECT COALESCE(free_credits, 0) INTO v_current_free
    FROM users WHERE clerk_user_id = v_user_record.user_id;
    
    -- Deduct excess credits
    UPDATE users
    SET free_credits = GREATEST(0, v_current_free - v_excess_credits),
        updated_at = NOW()
    WHERE clerk_user_id = v_user_record.user_id;
    
    -- Log the correction
    INSERT INTO credit_transactions (
      user_id,
      amount,
      balance_after,
      type,
      status,
      description,
      metadata
    )
    SELECT
      v_user_record.user_id,
      -v_excess_credits,
      (SELECT credits + COALESCE(free_credits, 0) FROM users WHERE clerk_user_id = v_user_record.user_id),
      'credit_adjustment',
      'success',
      'Rollback: Removed duplicate Free the Music credits',
      jsonb_build_object(
        'reason', 'duplicate_award',
        'original_amount', v_user_record.total_received,
        'corrected_amount', 24,
        'excess_removed', v_excess_credits,
        'correction_date', NOW()
      );
    
    -- Delete duplicate transaction records (keep first one)
    DELETE FROM credit_transactions
    WHERE id IN (
      SELECT id FROM credit_transactions
      WHERE user_id = v_user_record.user_id
        AND description LIKE '%Free the Music%'
        AND metadata->>'campaign' = 'free_the_music'
      ORDER BY created_at DESC
      OFFSET 1
    );
    
    RAISE NOTICE 'Corrected user %: removed % excess credits', v_user_record.user_id, v_excess_credits;
  END LOOP;
END;
$$;

-- Verify the rollback
SELECT 
  clerk_user_id,
  credits as paid,
  free_credits as free,
  (credits + COALESCE(free_credits, 0)) as total
FROM users
WHERE clerk_user_id IN (
  SELECT DISTINCT user_id 
  FROM credit_transactions 
  WHERE description LIKE '%Free the Music%' OR description LIKE '%Rollback%'
)
ORDER BY free_credits DESC;
