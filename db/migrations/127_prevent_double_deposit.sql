-- Migration 127: Prevent double wallet deposits (race condition fix)
-- Problem: verify route and webhook can both fire for the same payment,
-- causing $2 deposit to become $4 if they race past each other's idempotency check.
-- Fix: Unique index on order_id for wallet_deposit transactions.

-- Unique index: only ONE successful wallet_deposit per order_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_wallet_deposit_order
ON credit_transactions ((metadata->>'order_id'))
WHERE type = 'wallet_deposit' AND status = 'success' AND metadata->>'order_id' IS NOT NULL;

-- Also add unique index on razorpay_payment_id as a second safety net
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_wallet_deposit_payment
ON credit_transactions ((metadata->>'razorpay_payment_id'))
WHERE type = 'wallet_deposit' AND status = 'success' AND metadata->>'razorpay_payment_id' IS NOT NULL;
