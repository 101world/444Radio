-- Migration 137: Voice Labs token sub-wallet
-- Each character of input text = 1 token.
-- Every 1000 tokens consumed = 3 credits deducted.
-- Token balance auto-refills when depleted.

ALTER TABLE users ADD COLUMN IF NOT EXISTS voice_labs_tokens INTEGER NOT NULL DEFAULT 0;

-- RPC: consume_voice_tokens
-- Consumes N tokens from the user's voice_labs_tokens balance.
-- When the balance goes to 0 or below, automatically deducts 3 credits
-- per 1000 tokens needed and refills the balance.
-- Returns: { success, tokens_remaining, credits_deducted, new_credits }
CREATE OR REPLACE FUNCTION consume_voice_tokens(
  p_clerk_user_id TEXT,
  p_token_count INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_tokens INTEGER;
  v_current_credits INTEGER;
  v_credits_needed INTEGER := 0;
  v_tokens_to_buy INTEGER := 0;
  v_new_tokens INTEGER;
  v_new_credits INTEGER;
BEGIN
  -- Lock the user row
  SELECT voice_labs_tokens, credits
  INTO v_current_tokens, v_current_credits
  FROM users
  WHERE clerk_user_id = p_clerk_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_message', 'User not found'
    );
  END IF;

  -- Calculate remaining tokens after consumption
  v_new_tokens := v_current_tokens - p_token_count;

  -- If balance goes below 0, we need to buy more tokens with credits
  IF v_new_tokens < 0 THEN
    -- How many tokens do we need to cover the deficit?
    -- Each 1000 tokens costs 3 credits. Buy in blocks of 1000.
    v_tokens_to_buy := CEIL(ABS(v_new_tokens)::NUMERIC / 1000) * 1000;
    v_credits_needed := (v_tokens_to_buy / 1000) * 3;

    -- Check if user has enough credits
    IF v_current_credits < v_credits_needed THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_message', format('Insufficient credits. Need %s credits for %s tokens.', v_credits_needed, p_token_count),
        'credits_needed', v_credits_needed,
        'credits_available', v_current_credits
      );
    END IF;

    -- Deduct credits and add tokens
    v_new_tokens := v_new_tokens + v_tokens_to_buy;
    v_new_credits := v_current_credits - v_credits_needed;

    UPDATE users
    SET voice_labs_tokens = v_new_tokens,
        credits = v_new_credits
    WHERE clerk_user_id = p_clerk_user_id;
  ELSE
    -- Enough tokens, just deduct
    v_new_credits := v_current_credits;

    UPDATE users
    SET voice_labs_tokens = v_new_tokens
    WHERE clerk_user_id = p_clerk_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'tokens_remaining', v_new_tokens,
    'tokens_consumed', p_token_count,
    'credits_deducted', v_credits_needed,
    'new_credits', v_new_credits
  );
END;
$$;

-- RPC: get_voice_token_balance
-- Returns current token balance and credits for a user.
CREATE OR REPLACE FUNCTION get_voice_token_balance(p_clerk_user_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tokens INTEGER;
  v_credits INTEGER;
BEGIN
  SELECT voice_labs_tokens, credits
  INTO v_tokens, v_credits
  FROM users
  WHERE clerk_user_id = p_clerk_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_message', 'User not found');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'tokens', v_tokens,
    'credits', v_credits
  );
END;
$$;
