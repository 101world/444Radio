-- ============================================================================
-- CREDIT LOCKDOWN: Remove ALL database triggers and functions that can silently
-- add/gift/reset credits. After this, credits can ONLY be added via:
--   1. /api/credits/award (decrypt code "FREE THE MUSIC" — 20cr, lifetime)
--   2. /api/subscriptions/verify (paid Razorpay subscription)
--   3. /api/webhooks/razorpay (subscription.charged — monthly renewal)
--   4. /api/webhooks/paypal (PayPal subscription activation)
--   5. /api/earn/purchase (artist share — 1cr per sale)
--   6. Legitimate refunds (failed generations refund exact amount deducted)
--
-- Everything else is a LEAK and must be removed.
-- Date: 2026-02-15
-- ============================================================================

-- ── 1. Remove the add_signup_bonus trigger ──
-- This fires on every INSERT into users and calls add_signup_credits()
-- which silently adds 20 credits to new users. Users should start at 0
-- and get credits ONLY through /decrypt.
DROP TRIGGER IF EXISTS add_signup_bonus ON public.users;

-- ── 2. Remove the add_signup_credits function ──
-- Even without the trigger, this can be called via Supabase RPC.
-- Anyone with the anon key could call it to give themselves 20 credits.
DROP FUNCTION IF EXISTS public.add_signup_credits(TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.add_signup_credits(TEXT);
DROP FUNCTION IF EXISTS public.add_signup_credits();

-- ── 3. Remove the ensure_subscriber_credits trigger ──
-- This fires on EVERY INSERT OR UPDATE on users. On INSERT with credits=20
-- for active subscribers, it bumps credits to plan amount (100/600/1500).
-- On UPDATE where credits go from >20 to exactly 20, it also bumps.
-- This was meant to protect against bulk resets but it's a hidden credit
-- source that makes debugging impossible.
DROP TRIGGER IF EXISTS ensure_subscriber_credits ON public.users;

-- ── 4. Remove the protect_subscriber_credits function ──
-- With the trigger gone, the function is dead code. Remove it.
DROP FUNCTION IF EXISTS public.protect_subscriber_credits();

-- ── 5. Remove the old deduct_generation_credit function ──
-- Legacy function that's been replaced by deduct_credits.
-- Can be called via RPC and does UPDATE credits = credits - 1 without checks.
DROP FUNCTION IF EXISTS public.deduct_generation_credit(TEXT);

-- ── 6. Ensure the users table default is 0, not 20 ──
-- The column default should be 0. If it's 20 from the original schema,
-- fix it so any new row inserted via raw SQL also starts at 0.
ALTER TABLE public.users ALTER COLUMN credits SET DEFAULT 0;

-- ── 7. Revoke RPC access to add_signup_credits (belt and suspenders) ──
-- Already dropped above, but in case another overload exists:
DO $$
BEGIN
  -- Try revoking all known signatures
  EXECUTE 'REVOKE ALL ON FUNCTION public.add_signup_credits(TEXT, INTEGER) FROM anon, authenticated, service_role';
EXCEPTION WHEN OTHERS THEN
  -- Function doesn't exist, which is the goal
  NULL;
END;
$$;

DO $$
BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.add_signup_credits(TEXT) FROM anon, authenticated, service_role';
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- ============================================================================
-- VERIFICATION QUERIES (run these after to confirm):
--
-- Check no credit triggers remain on users table:
--   SELECT tgname, tgtype, proname
--   FROM pg_trigger t JOIN pg_proc p ON t.tgfoid = p.oid
--   JOIN pg_class c ON t.tgrelid = c.oid
--   WHERE c.relname = 'users';
--
-- Check add_signup_credits is gone:
--   SELECT proname FROM pg_proc WHERE proname = 'add_signup_credits';
--
-- Check protect_subscriber_credits is gone:
--   SELECT proname FROM pg_proc WHERE proname = 'protect_subscriber_credits';
--
-- Check users.credits default is 0:
--   SELECT column_default FROM information_schema.columns
--   WHERE table_name = 'users' AND column_name = 'credits';
-- ============================================================================
