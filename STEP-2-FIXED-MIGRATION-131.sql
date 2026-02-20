-- ============================================================================
-- 131: UPGRADE EXISTING USERS WITH +24 FREE CREDITS (DUPLICATE-SAFE)
--
-- FIXED: Checks if user already received upgrade before awarding
-- Only awards to users who haven't received it yet
-- ============================================================================

DO $$
DECLARE
  v_count INTEGER := 0;
  v_skipped INTEGER := 0;
  v_user_record RECORD;
  v_already_awarded BOOLEAN;
BEGIN
  FOR v_user_record IN
    SELECT DISTINCT cr.clerk_user_id
    FROM public.code_redemptions cr
    WHERE cr.code = 'FREE THE MUSIC' AND cr.clerk_user_id IS NOT NULL
  LOOP
    -- Check if user already received this upgrade
    SELECT EXISTS (
      SELECT 1 FROM credit_transactions
      WHERE user_id = v_user_record.clerk_user_id
        AND description LIKE '%Free the Music%'
        AND metadata->>'campaign' = 'free_the_music'
    ) INTO v_already_awarded;
    
    IF v_already_awarded THEN
      v_skipped := v_skipped + 1;
      RAISE NOTICE 'Skipping user % - already received upgrade', v_user_record.clerk_user_id;
      CONTINUE;
    END IF;
    
    -- Award 24 free credits using RPC (logs transaction automatically)
    BEGIN
      PERFORM award_free_credits(
        v_user_record.clerk_user_id,
        24,
        'Free the Music credits upgrade from admin — +24 credits',
        jsonb_build_object(
          'source', 'admin_upgrade',
          'campaign', 'free_the_music',
          'upgrade_date', NOW()
        )
      );
      
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to award credits to user %: %', v_user_record.clerk_user_id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '✅ Upgraded % users with +24 free credits (skipped % already upgraded)', v_count, v_skipped;
END;
$$;

-- Verification: Should show exactly 24 per user
SELECT 
  user_id,
  COUNT(*) as award_count,
  SUM(amount) as total_credits
FROM credit_transactions
WHERE description LIKE '%Free the Music%'
  AND metadata->>'campaign' = 'free_the_music'
GROUP BY user_id
ORDER BY total_credits DESC
LIMIT 20;
