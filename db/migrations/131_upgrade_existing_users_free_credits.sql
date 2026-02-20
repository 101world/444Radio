-- ============================================================================
-- 131: UPGRADE EXISTING USERS WITH +24 FREE CREDITS
--
-- Part of "Free the Music" upgrade: Give all existing users who claimed
-- the original 20-credit code an additional 24 credits (total 44).
--
-- Also logs a notification and wallet transaction for transparency.
--
-- Run this AFTER migration 130.
-- Date: 2026-02-20
-- ============================================================================

-- ── 1. Create notifications table if not exists ───────────────────────────
-- Drop table if it exists from previous failed run
DROP TABLE IF EXISTS public.notifications CASCADE;

CREATE TABLE public.notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info', -- 'info', 'success', 'warning', 'error'
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read) WHERE is_read = false;

-- ── 2. Award +24 credits to users who claimed "FREE THE MUSIC" code ──────
-- Find users who have redeemed the code (exists in code_redemptions)
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
    -- Award 24 free credits
    UPDATE public.users
    SET free_credits = COALESCE(free_credits, 0) + 24,
        updated_at = NOW()
    WHERE clerk_user_id = v_user_record.clerk_user_id;

    -- Log transaction
    BEGIN
      INSERT INTO public.credit_transactions (
        user_id,
        amount,
        balance_after,
        type,
        status,
        description,
        metadata
      )
      SELECT
        v_user_record.clerk_user_id,
        24,
        COALESCE(free_credits, 0),
        'credit_award',
        'success',
        'Free the Music credits upgrade from admin — +24 credits',
        jsonb_build_object(
          'source', 'admin_upgrade',
          'campaign', 'free_the_music',
          'is_free_credits', true,
          'upgrade_date', NOW()
        )
      FROM public.users
      WHERE clerk_user_id = v_user_record.clerk_user_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to log transaction for user %: %', v_user_record.clerk_user_id, SQLERRM;
    END;

    -- Create notification
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
        'You''ve received +24 bonus credits! Keep vibing with 444 Radio. Here for the community. Generate for free, then $1 access + pay-per-usage.',
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

  RAISE NOTICE 'Successfully upgraded % users with +24 free credits', v_count;
END;
$$;

-- ── 3. Verification queries ───────────────────────────────────────────────
-- Check total users upgraded
SELECT COUNT(DISTINCT cr.clerk_user_id) as users_upgraded
FROM public.code_redemptions cr
WHERE cr.code = 'FREE THE MUSIC';

-- Check free_credits distribution
SELECT
  COUNT(*) as total_users_with_free_credits,
  SUM(free_credits) as total_free_credits,
  AVG(free_credits) as avg_free_credits,
  MAX(free_credits) as max_free_credits
FROM public.users
WHERE free_credits > 0;

-- Check recent notifications
SELECT
  user_id,
  title,
  message,
  created_at
FROM public.notifications
WHERE type = 'success'
  AND metadata->>'campaign' = 'free_the_music'
ORDER BY created_at DESC
LIMIT 10;

-- Check recent credit transactions
SELECT
  user_id,
  amount,
  description,
  created_at
FROM public.credit_transactions
WHERE type = 'credit_award'
  AND description LIKE '%Free the Music%'
ORDER BY created_at DESC
LIMIT 10;

COMMENT ON TABLE public.notifications IS 'User notifications for system events and upgrades';
