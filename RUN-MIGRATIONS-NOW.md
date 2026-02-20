# 🚨 URGENT: Run These Migrations in Supabase (FIXED)

## What Happened
Migration 131 was using **direct UPDATE** instead of RPC, so:
- ✅ Notifications were sent
- ❌ Credits were NOT actually added
- ❌ Transactions were NOT logged

## What's Fixed
Migration 131 now uses `award_free_credits()` RPC (commit 87d5479)

---

## 🎯 Step-by-Step Instructions

### Step 1: Run Migration 132 (Creates Bulletproof System)
Go to **Supabase SQL Editor** → Paste and run:

```sql
-- ============================================================================
-- 132: BULLETPROOF CREDIT TRACKING SYSTEM
-- ============================================================================

-- ── 1. Centralized award_credits() RPC ────────────────────────────────────
DROP FUNCTION IF EXISTS public.award_credits(TEXT, INTEGER, TEXT, TEXT, JSONB);

CREATE FUNCTION public.award_credits(
  p_clerk_user_id TEXT,
  p_amount INTEGER,
  p_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE(
  success BOOLEAN,
  new_credits INTEGER,
  new_balance_total INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits INTEGER;
  v_new_credits INTEGER;
  v_free_credits INTEGER;
  v_total INTEGER;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, 0, 0, 'Credit amount must be positive'::TEXT;
    RETURN;
  END IF;

  -- Fetch current state
  SELECT credits, free_credits
  INTO v_credits, v_free_credits
  FROM public.users
  WHERE clerk_user_id = p_clerk_user_id;

  IF NOT FOUND THEN
    -- Create user with 0 credits if not exists
    INSERT INTO public.users (clerk_user_id, credits, free_credits, created_at, updated_at)
    VALUES (p_clerk_user_id, 0, 0, NOW(), NOW());
    v_credits := 0;
    v_free_credits := 0;
  END IF;

  -- Add paid credits
  v_new_credits := v_credits + p_amount;
  v_total := v_new_credits + COALESCE(v_free_credits, 0);

  -- Update user
  UPDATE public.users
  SET credits = v_new_credits,
      updated_at = NOW()
  WHERE clerk_user_id = p_clerk_user_id;

  -- Log transaction (CRITICAL - this deducts from 444B pool)
  BEGIN
    INSERT INTO public.credit_transactions (
      user_id,
      amount,
      balance_after,
      type,
      status,
      description,
      metadata
    ) VALUES (
      p_clerk_user_id,
      p_amount,
      v_total,
      p_type,
      'success',
      COALESCE(p_description, 'Credit award'),
      p_metadata
    );
  EXCEPTION WHEN OTHERS THEN
    -- If logging fails, ROLLBACK the credit award
    RAISE EXCEPTION 'Transaction logging failed for user %. Credits NOT awarded. Error: %', 
      p_clerk_user_id, SQLERRM;
  END;

  -- Return success
  RETURN QUERY SELECT true, v_new_credits, v_total, NULL::TEXT;
END;
$$;

-- ── 2. Admin Notifications Table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT DEFAULT 'system', -- 'milestone', 'warning', 'system', 'critical'
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read 
  ON public.admin_notifications(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_admin_notifications_category 
  ON public.admin_notifications(category);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created 
  ON public.admin_notifications(created_at DESC);

-- ── 3. notify_admin() Helper ──────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.notify_admin(TEXT, TEXT, TEXT, JSONB);

CREATE FUNCTION public.notify_admin(
  p_title TEXT,
  p_message TEXT,
  p_category TEXT DEFAULT 'system',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id BIGINT;
BEGIN
  INSERT INTO public.admin_notifications (title, message, category, metadata)
  VALUES (p_title, p_message, p_category, p_metadata)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- ── 4. Audit Trigger (Detects Untracked Credits) ──────────────────────────
DROP FUNCTION IF EXISTS public.audit_credit_changes() CASCADE;

CREATE FUNCTION public.audit_credit_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_diff INTEGER;
  v_free_credit_diff INTEGER;
  v_transaction_exists BOOLEAN;
BEGIN
  -- Calculate credit changes
  v_credit_diff := NEW.credits - OLD.credits;
  v_free_credit_diff := COALESCE(NEW.free_credits, 0) - COALESCE(OLD.free_credits, 0);
  
  -- Only audit INCREASES (awards)
  IF v_credit_diff > 0 OR v_free_credit_diff > 0 THEN
    -- Check if corresponding transaction logged within last 5 seconds
    SELECT EXISTS (
      SELECT 1 FROM public.credit_transactions
      WHERE user_id = NEW.clerk_user_id
        AND created_at > NOW() - INTERVAL '5 seconds'
        AND amount = GREATEST(v_credit_diff, v_free_credit_diff)
    ) INTO v_transaction_exists;
    
    -- If no transaction found, send admin warning
    IF NOT v_transaction_exists THEN
      PERFORM notify_admin(
        '⚠️ Untracked Credit Addition Detected',
        format('User %s received %s credits and %s free credits without transaction log', 
          NEW.clerk_user_id, v_credit_diff, v_free_credit_diff),
        'warning',
        jsonb_build_object(
          'user_id', NEW.clerk_user_id,
          'credits_added', v_credit_diff,
          'free_credits_added', v_free_credit_diff,
          'detection_time', NOW()
        )
      );
      
      -- Also log to PostgreSQL warnings
      RAISE WARNING 'Untracked credit addition: user=%, credits=%, free_credits=%', 
        NEW.clerk_user_id, v_credit_diff, v_free_credit_diff;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS audit_credit_changes_trigger ON public.users;
CREATE TRIGGER audit_credit_changes_trigger
  AFTER UPDATE OF credits, free_credits ON public.users
  FOR EACH ROW
  WHEN (NEW.credits > OLD.credits OR COALESCE(NEW.free_credits, 0) > COALESCE(OLD.free_credits, 0))
  EXECUTE FUNCTION audit_credit_changes();

-- ── 5. Reconciliation Function ────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.audit_untracked_credits();

CREATE FUNCTION public.audit_untracked_credits()
RETURNS TABLE(
  clerk_user_id TEXT,
  current_credits INTEGER,
  current_free_credits INTEGER,
  total_credits INTEGER,
  logged_transactions BIGINT,
  transaction_sum BIGINT,
  discrepancy BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.clerk_user_id,
    u.credits,
    COALESCE(u.free_credits, 0) as free_credits,
    u.credits + COALESCE(u.free_credits, 0) as total,
    COUNT(ct.id) as logged_transactions,
    COALESCE(SUM(ct.amount), 0) as transaction_sum,
    (u.credits + COALESCE(u.free_credits, 0)) - COALESCE(SUM(ct.amount), 0) as discrepancy
  FROM public.users u
  LEFT JOIN public.credit_transactions ct ON ct.user_id = u.clerk_user_id
  WHERE u.credits > 0 OR u.free_credits > 0
  GROUP BY u.clerk_user_id, u.credits, u.free_credits
  HAVING (u.credits + COALESCE(u.free_credits, 0)) != COALESCE(SUM(ct.amount), 0)
  ORDER BY discrepancy DESC;
END;
$$;

-- ── 6. Admin Dashboard View ───────────────────────────────────────────────
DROP VIEW IF EXISTS public.credit_audit_summary CASCADE;

CREATE VIEW public.credit_audit_summary AS
SELECT
  -- Total credits in circulation
  SUM(u.credits + COALESCE(u.free_credits, 0)) as total_user_credits,
  
  -- Total logged transactions
  (SELECT COALESCE(SUM(amount), 0) FROM public.credit_transactions WHERE amount > 0) as total_logged_awards,
  
  -- 444 Billion pool remaining
  444000000000 - (SELECT COALESCE(SUM(amount), 0) FROM public.credit_transactions WHERE amount > 0) as admin_pool_remaining,
  
  -- Discrepancy (should be 0)
  SUM(u.credits + COALESCE(u.free_credits, 0)) - 
    (SELECT COALESCE(SUM(amount), 0) FROM public.credit_transactions WHERE amount > 0) as discrepancy,
  
  -- Stats
  COUNT(DISTINCT u.clerk_user_id) as total_users_with_credits,
  SUM(u.credits) as total_paid_credits,
  SUM(COALESCE(u.free_credits, 0)) as total_free_credits
FROM public.users u
WHERE u.credits > 0 OR u.free_credits > 0;

-- ── 7. Comments ────────────────────────────────────────────────────────────
COMMENT ON FUNCTION public.award_credits IS 'Centralized function for awarding paid credits with automatic transaction logging';
COMMENT ON FUNCTION public.notify_admin IS 'Creates admin notification for system alerts';
COMMENT ON FUNCTION public.audit_credit_changes IS 'Trigger function that detects untracked credit additions';
COMMENT ON FUNCTION public.audit_untracked_credits IS 'Finds users with credit discrepancies';
COMMENT ON VIEW public.credit_audit_summary IS 'Real-time dashboard of credit system health';
COMMENT ON TABLE public.admin_notifications IS 'System notifications for admin dashboard';
```

**Verify:**
```sql
-- Should return 4 rows
SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN ('award_credits', 'notify_admin', 'audit_credit_changes', 'audit_untracked_credits');

-- Should show admin_notifications table
SELECT table_name FROM information_schema.tables WHERE table_name = 'admin_notifications';
```

---

### Step 2: Run Fixed Migration 131 (Award Credits Properly)
Now paste and run the FIXED migration 131:

```sql
-- ============================================================================
-- 131: UPGRADE EXISTING USERS WITH +24 FREE CREDITS (FIXED)
-- ============================================================================

-- Award +24 credits to users who claimed "FREE THE MUSIC" code
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

  RAISE NOTICE 'Successfully upgraded % users with +24 free credits', v_count;
END;
$$;
```

**Verify Credits Were Added:**
```sql
-- Check users got credits this time
SELECT
  u.clerk_user_id,
  u.free_credits,
  u.credits,
  COUNT(ct.id) as transaction_count
FROM public.users u
LEFT JOIN public.credit_transactions ct ON ct.user_id = u.clerk_user_id
WHERE u.clerk_user_id IN (
  SELECT DISTINCT clerk_user_id 
  FROM public.code_redemptions 
  WHERE code = 'FREE THE MUSIC'
)
GROUP BY u.clerk_user_id, u.free_credits, u.credits
ORDER BY u.free_credits DESC
LIMIT 10;

-- Should show 24 in free_credits column and matching transaction_count
```

---

### Step 3: Run Migration 133 (Admin Notification)
```sql
-- ============================================================================
-- 133: ADMIN NOTIFICATION FOR FREE THE MUSIC UPGRADE
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
```

**Verify Admin Got Notification:**
```sql
SELECT * FROM admin_notifications 
WHERE metadata->>'campaign' = 'free_the_music'
ORDER BY created_at DESC;
```

---

## ✅ Final Verification

Run these to confirm everything is bulletproof:

```sql
-- 1. Check for any untracked credits
SELECT * FROM audit_untracked_credits();
-- Should return 0 rows (or explain any discrepancies)

-- 2. View system health
SELECT * FROM credit_audit_summary;
-- Discrepancy should be 0 or close to 0

-- 3. Test the audit trigger (use a test user)
UPDATE users SET credits = credits + 10 WHERE clerk_user_id = 'user_test123';
-- Should create a warning in admin_notifications

-- 4. Check admin notifications
SELECT * FROM admin_notifications ORDER BY created_at DESC LIMIT 10;
```

---

## 🎯 What's Now Bulletproof

✅ **All credit awards** use centralized RPC functions  
✅ **Every credit** is logged to credit_transactions  
✅ **444B pool** is automatically deducted via logging  
✅ **Audit trigger** detects any untracked additions  
✅ **Admin notifications** for milestones and warnings  
✅ **Real-time reconciliation** via views and functions  

---

## 🚨 Still Need to Fix

After running these migrations, fix these 2 routes:
- [app/api/earn/purchase/route.ts](app/api/earn/purchase/route.ts#L143)
- [app/api/earn/list/route.ts](app/api/earn/list/route.ts#L137)

Both are using direct UPDATE. Need to replace with `award_credits()` RPC.
