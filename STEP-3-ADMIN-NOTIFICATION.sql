-- ============================================================================
-- STEP 3 OF 3: Send admin notification about Free the Music upgrade
-- Run this AFTER Steps 1 and 2
-- Copy this entire file and paste into Supabase SQL Editor
-- ============================================================================

DO $$
DECLARE
  v_users_upgraded INTEGER;
  v_total_credits_distributed INTEGER;
  v_admin_wallet_remaining NUMERIC;
  v_total_awarded NUMERIC;
BEGIN
  -- Count users who got the upgrade
  SELECT COUNT(*) INTO v_users_upgraded
  FROM public.credit_transactions
  WHERE type = 'credit_award'
    AND description LIKE '%Free the Music%'
    AND metadata->>'campaign' = 'free_the_music';
  
  -- Calculate total credits distributed
  v_total_credits_distributed := v_users_upgraded * 24;
  
  -- Calculate current admin wallet status
  SELECT COALESCE(SUM(amount), 0) INTO v_total_awarded
  FROM public.credit_transactions
  WHERE amount > 0 AND status = 'success';
  
  v_admin_wallet_remaining := 444000000000 - v_total_awarded;
  
  -- Send admin notification
  INSERT INTO public.admin_notifications (
    title,
    message,
    category,
    metadata
  ) VALUES (
    '🎵 Free the Music Upgrade Complete',
    format('Successfully distributed %s credits to %s users. Admin wallet: %s remaining (%s%% of 444B allocation used)',
      v_total_credits_distributed,
      v_users_upgraded,
      v_admin_wallet_remaining,
      ROUND((v_total_awarded / 444000000000.0 * 100)::numeric, 6)
    ),
    'milestone',
    jsonb_build_object(
      'campaign', 'free_the_music',
      'users_upgraded', v_users_upgraded,
      'credits_distributed', v_total_credits_distributed,
      'credits_per_user', 24,
      'total_credits_awarded_system_wide', v_total_awarded,
      'admin_wallet_remaining', v_admin_wallet_remaining,
      'allocation_used_percent', (v_total_awarded / 444000000000.0 * 100),
      'upgrade_date', NOW()
    )
  );
  
  RAISE NOTICE '✅ Admin notified: % users upgraded, % credits distributed', 
    v_users_upgraded, v_total_credits_distributed;
END;
$$;

-- ============================================================================
-- STEP 3 VERIFICATION: Check the notification was created
-- ============================================================================

SELECT 'Admin notification:' as status;
SELECT 
  title,
  message,
  category,
  metadata,
  created_at
FROM public.admin_notifications
WHERE metadata->>'campaign' = 'free_the_music'
ORDER BY created_at DESC
LIMIT 1;

-- ============================================================================
-- FINAL SYSTEM HEALTH CHECK
-- ============================================================================

SELECT 'System health check:' as status;
SELECT * FROM credit_audit_summary;

SELECT 'Any untracked credits? (Should be empty):' as status;
SELECT * FROM audit_untracked_credits();
