-- Migration 122: Make plugin free for all authenticated users
-- Previously, validate_plugin_token denied access to users without
-- a Pro/Studio subscription or a $25 one-time purchase.
-- Now any user with a valid token can use the plugin.
-- Tier is still tracked for analytics but never blocks access.

DROP FUNCTION IF EXISTS validate_plugin_token(text) CASCADE;

CREATE OR REPLACE FUNCTION validate_plugin_token(p_token TEXT)
RETURNS TABLE (
  user_id       TEXT,
  token_id      UUID,
  is_valid      BOOLEAN,
  error_message TEXT,
  access_tier   TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_record RECORD;
  v_user_record  RECORD;
  v_has_purchase BOOLEAN;
  v_tier         TEXT;
  v_daily_limit  INTEGER;
BEGIN
  -- ── 1. Find active token ──────────────────────────────────────────
  SELECT pt.id, pt.clerk_user_id, pt.is_active, pt.expires_at,
         pt.requests_today, pt.requests_reset_at
  INTO v_token_record
  FROM plugin_tokens pt
  WHERE pt.token = p_token AND pt.is_active = true;

  IF v_token_record IS NULL THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::UUID, false,
      'Invalid or revoked token'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- Check expiry
  IF v_token_record.expires_at IS NOT NULL AND v_token_record.expires_at < NOW() THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::UUID, false,
      'Token expired'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- ── 2. Fetch user info (just to confirm account exists) ───────────
  SELECT u.subscription_status, u.subscription_plan
  INTO v_user_record
  FROM users u
  WHERE u.clerk_user_id = v_token_record.clerk_user_id;

  IF v_user_record IS NULL THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::UUID, false,
      'User account not found'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- ── 3. Determine tier for analytics (never deny access) ───────────
  -- Studio plan (active)?
  IF v_user_record.subscription_status = 'active' AND (
       v_user_record.subscription_plan LIKE '%studio%' OR
       v_user_record.subscription_plan IN ('plan_S2DIdCKNcV6TtA', 'plan_S2DOABOeGedJHk')
     ) THEN
    v_tier := 'studio';
    v_daily_limit := 0;  -- unlimited

  -- Pro plan (active)?
  ELSIF v_user_record.subscription_status = 'active' AND (
          v_user_record.subscription_plan LIKE '%pro%' OR
          v_user_record.subscription_plan IN ('plan_S2DHUGo7n1m6iv', 'plan_S2DNEvy1YzYWNh')
        ) THEN
    v_tier := 'pro';
    v_daily_limit := 2000;

  ELSE
    -- Check for one-time plugin purchase (for analytics)
    SELECT EXISTS (
      SELECT 1 FROM plugin_purchases pp
      WHERE pp.clerk_user_id = v_token_record.clerk_user_id
        AND pp.status = 'completed'
    ) INTO v_has_purchase;

    IF v_has_purchase THEN
      v_tier := 'purchased';
    ELSE
      v_tier := 'free';         -- FREE tier — plugin is now free for all
    END IF;

    v_daily_limit := 2000;      -- generous daily limit for free/purchased users
  END IF;

  -- ── 4. Rate limiting (only for tiers with a limit) ────────────────
  IF v_daily_limit > 0 THEN
    IF v_token_record.requests_reset_at IS NULL
       OR v_token_record.requests_reset_at < NOW() - INTERVAL '24 hours' THEN
      -- Reset counter for new day
      UPDATE plugin_tokens SET requests_today = 1, requests_reset_at = NOW()
      WHERE id = v_token_record.id;
    ELSIF v_token_record.requests_today >= v_daily_limit THEN
      RETURN QUERY SELECT NULL::TEXT, NULL::UUID, false,
        ('Daily rate limit exceeded (' || v_daily_limit || '/day). Try again tomorrow.')::TEXT,
        v_tier::TEXT;
      RETURN;
    ELSE
      UPDATE plugin_tokens SET requests_today = requests_today + 1
      WHERE id = v_token_record.id;
    END IF;
  ELSE
    -- Unlimited tier — still increment counter for analytics
    IF v_token_record.requests_reset_at IS NULL
       OR v_token_record.requests_reset_at < NOW() - INTERVAL '24 hours' THEN
      UPDATE plugin_tokens SET requests_today = 1, requests_reset_at = NOW()
      WHERE id = v_token_record.id;
    ELSE
      UPDATE plugin_tokens SET requests_today = requests_today + 1
      WHERE id = v_token_record.id;
    END IF;
  END IF;

  -- ── 5. Update last used & return success ──────────────────────────
  UPDATE plugin_tokens SET last_used_at = NOW() WHERE id = v_token_record.id;

  RETURN QUERY SELECT v_token_record.clerk_user_id, v_token_record.id, true, NULL::TEXT, v_tier;
END;
$$;
