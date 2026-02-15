-- ══════════════════════════════════════════════════════════════════════════
-- 022: Raise plugin token rate limit from 100 to 2000 requests/day
-- The plugin makes many API calls per session (chat, credits, generate,
-- jobs, atom-genre, etc.) so 100/day is far too low for normal usage.
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION validate_plugin_token(p_token TEXT)
RETURNS TABLE (user_id TEXT, token_id UUID, is_valid BOOLEAN, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_record RECORD;
BEGIN
  -- Find active token
  SELECT pt.id, pt.clerk_user_id, pt.is_active, pt.expires_at,
         pt.requests_today, pt.requests_reset_at
  INTO v_token_record
  FROM plugin_tokens pt
  WHERE pt.token = p_token AND pt.is_active = true;
  
  IF v_token_record IS NULL THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::UUID, false, 'Invalid or revoked token'::TEXT;
    RETURN;
  END IF;
  
  -- Check expiry
  IF v_token_record.expires_at IS NOT NULL AND v_token_record.expires_at < NOW() THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::UUID, false, 'Token expired'::TEXT;
    RETURN;
  END IF;
  
  -- Rate limit: 2000 requests per day (raised from 100 — plugin is chatty)
  IF v_token_record.requests_reset_at < NOW() - INTERVAL '24 hours' THEN
    -- Reset counter
    UPDATE plugin_tokens SET requests_today = 1, requests_reset_at = NOW() WHERE id = v_token_record.id;
  ELSIF v_token_record.requests_today >= 2000 THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::UUID, false, 'Daily rate limit exceeded (2000/day)'::TEXT;
    RETURN;
  ELSE
    UPDATE plugin_tokens SET requests_today = requests_today + 1 WHERE id = v_token_record.id;
  END IF;
  
  -- Update last used
  UPDATE plugin_tokens SET last_used_at = NOW() WHERE id = v_token_record.id;
  
  RETURN QUERY SELECT v_token_record.clerk_user_id, v_token_record.id, true, NULL::TEXT;
END;
$$;

-- Also reset any users who are currently rate-limited so they can use the plugin immediately
UPDATE plugin_tokens 
SET requests_today = 0, requests_reset_at = NOW()
WHERE requests_today >= 100;
