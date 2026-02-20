-- ============================================================================
-- STEP 2 OF 3: Award +24 free_credits to all users who redeemed FREE THE MUSIC
-- Run this AFTER Step 1
-- Copy this entire file and paste into Supabase SQL Editor
-- ============================================================================

DO $$
DECLARE
  v_count INTEGER := 0;
  v_user_record RECORD;
BEGIN
  FOR v_user_record IN
    SELECT DISTINCT cr.clerk_user_id
    FROM public.code_redemptions cr
    WHERE cr.code = 'FREE THE MUSIC'
      AND cr.clerk_user_id IS NOT NULL
  LOOP
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
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to award credits to user %: %', v_user_record.clerk_user_id, SQLERRM;
    END;

    -- Create notification (optional, doesn't block if it fails)
    BEGIN
      INSERT INTO public.notifications (
        user_id,
        title,
        message,
        type,
        metadata
      ) VALUES (
        v_user_record.clerk_user_id,
        '🎵 Free the Music Upgrade!',
        'You''ve received +24 bonus credits! Keep vibing with 444 Radio. Generate for free, then $1 access + pay-per-usage.',
        'success',
        jsonb_build_object(
          'credits_added', 24,
          'source', 'admin_upgrade',
          'campaign', 'free_the_music'
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create notification for user %: %', v_user_record.clerk_user_id, SQLERRM;
    END;

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE '✅ Successfully upgraded % users with +24 free credits', v_count;
END;
$$;

-- ============================================================================
-- STEP 2 VERIFICATION: Check users received the credits
-- ============================================================================

SELECT 'Users who should have received +24 free credits:' as status;
SELECT 
  u.clerk_user_id,
  u.free_credits,
  u.credits,
  u.credits + COALESCE(u.free_credits, 0) as total_credits,
  COUNT(ct.id) as transactions_logged
FROM public.users u
LEFT JOIN public.credit_transactions ct ON ct.user_id = u.clerk_user_id
WHERE u.clerk_user_id IN (
  SELECT DISTINCT clerk_user_id 
  FROM public.code_redemptions 
  WHERE code = 'FREE THE MUSIC'
)
GROUP BY u.clerk_user_id, u.free_credits, u.credits
ORDER BY u.free_credits DESC, u.credits DESC
LIMIT 10;
