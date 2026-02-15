-- Migration 023: Tier-based plugin access control
--
-- NEW RULES:
--   Studio (active)   → Unlimited requests/day
--   Pro (active)      → 200 requests/day
--   Creator/Free WITH plugin_purchase → Unlimited forever
--   Creator/Free WITHOUT purchase     → Rejected ("Buy plugin $25")
--   Studio (inactive) → Rejected ("Subscribe to use plugin")
--
-- The function now JOINs the users table to read subscription_plan/status,
-- and checks plugin_purchases for one-time buyers.
-- Returns an extra column: access_tier TEXT
--   'studio' | 'pro' | 'purchased' | 'denied_inactive' | 'denied_no_purchase'

-- Ensure plugin_purchases table exists (needed by the function)
CREATE TABLE IF NOT EXISTS plugin_purchases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id   TEXT NOT NULL,
  order_id        TEXT,
  payment_id      TEXT,
  amount          INTEGER DEFAULT 2500,  -- cents
  currency        TEXT DEFAULT 'USD',
  status          TEXT DEFAULT 'pending',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure plugin_tokens has the columns we need
ALTER TABLE plugin_tokens ADD COLUMN IF NOT EXISTS requests_today INTEGER DEFAULT 0;
ALTER TABLE plugin_tokens ADD COLUMN IF NOT EXISTS requests_reset_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE plugin_tokens ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- Drop the old function completely (CASCADE handles any dependent objects)
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

  -- ── 2. Fetch user subscription info ───────────────────────────────
  SELECT u.subscription_status, u.subscription_plan
  INTO v_user_record
  FROM users u
  WHERE u.clerk_user_id = v_token_record.clerk_user_id;

  IF v_user_record IS NULL THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::UUID, false,
      'User account not found'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- ── 3. Determine access tier ──────────────────────────────────────
  -- Studio plan (active)?
  IF v_user_record.subscription_status = 'active' AND (
       v_user_record.subscription_plan LIKE '%studio%' OR
       v_user_record.subscription_plan IN ('plan_S2DIdCKNcV6TtA', 'plan_S2DOABOeGedJHk')
     ) THEN
    v_tier := 'studio';
    v_daily_limit := 0;  -- unlimited

  -- Studio plan (inactive/cancelled/expired)?
  ELSIF v_user_record.subscription_status != 'active' AND (
          v_user_record.subscription_plan LIKE '%studio%' OR
          v_user_record.subscription_plan IN ('plan_S2DIdCKNcV6TtA', 'plan_S2DOABOeGedJHk')
        ) THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::UUID, false,
      'Your Studio subscription is inactive. Please resubscribe to use the plugin.'::TEXT,
      'denied_inactive'::TEXT;
    RETURN;

  -- Pro plan (active)?
  ELSIF v_user_record.subscription_status = 'active' AND (
          v_user_record.subscription_plan LIKE '%pro%' OR
          v_user_record.subscription_plan IN ('plan_S2DHUGo7n1m6iv', 'plan_S2DNEvy1YzYWNh')
        ) THEN
    v_tier := 'pro';
    v_daily_limit := 200;

  ELSE
    -- Creator plan or Free (no subscription / creator sub)
    -- Check for one-time $25 plugin purchase
    SELECT EXISTS (
      SELECT 1 FROM plugin_purchases pp
      WHERE pp.clerk_user_id = v_token_record.clerk_user_id
        AND pp.status = 'completed'
    ) INTO v_has_purchase;

    IF v_has_purchase THEN
      v_tier := 'purchased';
      v_daily_limit := 0;  -- unlimited forever
    ELSE
      RETURN QUERY SELECT NULL::TEXT, NULL::UUID, false,
        'Plugin access requires a $25 one-time purchase or a Pro/Studio subscription.'::TEXT,
        'denied_no_purchase'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- ── 4. Rate limiting (only for tiers with a limit) ────────────────
  IF v_daily_limit > 0 THEN
    IF v_token_record.requests_reset_at < NOW() - INTERVAL '24 hours' THEN
      -- Reset counter for new day
      UPDATE plugin_tokens SET requests_today = 1, requests_reset_at = NOW()
      WHERE id = v_token_record.id;
    ELSIF v_token_record.requests_today >= v_daily_limit THEN
      RETURN QUERY SELECT NULL::TEXT, NULL::UUID, false,
        ('Daily rate limit exceeded (' || v_daily_limit || '/day). Upgrade to Studio for unlimited.')::TEXT,
        v_tier::TEXT;
      RETURN;
    ELSE
      UPDATE plugin_tokens SET requests_today = requests_today + 1
      WHERE id = v_token_record.id;
    END IF;
  ELSE
    -- Unlimited tier — still increment counter for analytics but no blocking
    IF v_token_record.requests_reset_at < NOW() - INTERVAL '24 hours' THEN
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
