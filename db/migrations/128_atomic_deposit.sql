-- Migration 128: Atomic deposit — prevents ALL double deposits
-- Replaces the old deposit_wallet + separate logCreditTransaction pattern
-- with a single locked PostgreSQL function that checks + deposits + logs atomically.

-- ─────────────────────────────────────────────────────
-- deposit_wallet_safe: ONE function, no race conditions
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION deposit_wallet_safe(
  p_clerk_user_id text,
  p_amount_usd numeric,
  p_order_id text,
  p_payment_id text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_user RECORD;
  v_new_balance numeric;
  v_already boolean;
BEGIN
  -- 1. Lock the user row (blocks all concurrent deposits for this user)
  SELECT * INTO v_user
  FROM users
  WHERE clerk_user_id = p_clerk_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_message', 'User not found');
  END IF;

  -- 2. Check if this order was already deposited (inside the lock = no race)
  SELECT EXISTS(
    SELECT 1 FROM credit_transactions
    WHERE type = 'wallet_deposit'
      AND metadata->>'order_id' = p_order_id
      AND status = 'success'
  ) INTO v_already;

  IF v_already THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'new_balance', COALESCE(v_user.wallet_balance, 0),
      'credits', COALESCE(v_user.credits, 0)
    );
  END IF;

  -- 3. Deposit dollars to wallet
  v_new_balance := COALESCE(v_user.wallet_balance, 0) + p_amount_usd;

  UPDATE users
  SET wallet_balance = v_new_balance, updated_at = NOW()
  WHERE clerk_user_id = p_clerk_user_id;

  -- 4. Log the transaction (same transaction = atomic with the deposit)
  INSERT INTO credit_transactions (user_id, amount, balance_after, type, status, description, metadata)
  VALUES (
    p_clerk_user_id,
    0,
    COALESCE(v_user.credits, 0),
    'wallet_deposit',
    'success',
    COALESCE(p_description, 'Wallet deposit: +$' || p_amount_usd || ' → wallet $' || v_new_balance),
    jsonb_build_object(
      'order_id', p_order_id,
      'razorpay_id', COALESCE(p_payment_id, p_order_id),
      'razorpay_payment_id', COALESCE(p_payment_id, ''),
      'deposit_usd', p_amount_usd,
      'wallet_balance', v_new_balance,
      'source', 'app'
    ) || p_metadata
  );

  -- 5. Return result
  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'new_balance', v_new_balance,
    'credits', COALESCE(v_user.credits, 0)
  );
END;
$$;

-- Also create the unique index as a belt-and-suspenders safety net
-- (clean up any remaining duplicates first)
DO $$
BEGIN
  -- Delete duplicate wallet_deposit rows (keep earliest per order_id)
  DELETE FROM credit_transactions
  WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY metadata->>'order_id'
        ORDER BY created_at ASC
      ) as rn
      FROM credit_transactions
      WHERE type = 'wallet_deposit'
        AND status = 'success'
        AND metadata->>'order_id' IS NOT NULL
    ) dupes
    WHERE rn > 1
  );
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_wallet_deposit_order
ON credit_transactions ((metadata->>'order_id'))
WHERE type = 'wallet_deposit' AND status = 'success' AND metadata->>'order_id' IS NOT NULL;
