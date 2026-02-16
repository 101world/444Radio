-- ============================================================
-- DIAGNOSE & FIX RIRI'S WALLET BALANCE
-- User: riri (user_34LKhAX7aYSnMboQLn5S8vVbzoQ)
-- She paid $2 but wallet shows $0
-- ============================================================

-- Step 1: Check current state
SELECT clerk_user_id, username, email, credits, wallet_balance, total_generated, created_at
FROM users WHERE clerk_user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ';

-- Step 2: Check ALL her transactions to trace where the money went
SELECT id, type, amount, balance_after, status, description,
       metadata->>'deposit_usd' as deposit_usd,
       metadata->>'wallet_balance' as wallet_in_meta,
       metadata->>'razorpay_payment_id' as razorpay_id,
       metadata->>'credit_source' as source,
       created_at
FROM credit_transactions
WHERE user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ'
ORDER BY created_at DESC;

-- Step 3: Check wallet-specific transactions
SELECT id, type, amount, description,
       metadata->>'deposit_usd' as deposit_usd,
       metadata->>'previous_wallet_balance' as prev_wallet,
       metadata->>'new_wallet_balance' as new_wallet,
       metadata->>'usd_converted' as usd_converted,
       metadata->>'credits_added' as credits_added,
       created_at
FROM credit_transactions
WHERE user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ'
  AND type IN ('wallet_deposit', 'wallet_conversion')
ORDER BY created_at DESC;

-- Step 4: Also check test056
SELECT clerk_user_id, username, email, credits, wallet_balance, total_generated
FROM users WHERE username ILIKE '%test056%' OR email ILIKE '%test056%';

-- Step 4b: Check test056 transactions too
SELECT id, type, amount, description,
       metadata->>'deposit_usd' as deposit_usd,
       metadata->>'wallet_balance' as wallet_in_meta,
       created_at
FROM credit_transactions
WHERE user_id = (SELECT clerk_user_id FROM users WHERE username ILIKE '%test056%' LIMIT 1)
  AND type IN ('wallet_deposit', 'wallet_conversion', 'credit_award')
ORDER BY created_at DESC;

-- ============================================================
-- FIX: Set wallet_balance to $1 for Riri (she paid $2, $1 must be locked)
-- And for test056 (he paid $1, $1 must be locked)
-- Only run this AFTER checking Step 1-4 above
-- ============================================================

-- Fix Riri — If wallet_balance is 0, set it to 1.00
UPDATE users
SET wallet_balance = GREATEST(wallet_balance, 1.00), updated_at = NOW()
WHERE clerk_user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ'
  AND (wallet_balance IS NULL OR wallet_balance < 1);

-- Log the fix for Riri
INSERT INTO credit_transactions (user_id, amount, balance_after, type, status, description, metadata)
SELECT
  'user_34LKhAX7aYSnMboQLn5S8vVbzoQ',
  0,
  (SELECT credits FROM users WHERE clerk_user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ'),
  'credit_refund',
  'success',
  'Wallet fix: restored $1 locked balance (payment processed before wallet system)',
  '{"fix_reason": "wallet_balance_zero_after_payment", "paid_total_usd": 2, "restored_wallet": 1.00}'::jsonb
WHERE (SELECT wallet_balance FROM users WHERE clerk_user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ') = 1.00;

-- Fix test056 — If wallet_balance is 0, set it to 1.00
UPDATE users
SET wallet_balance = GREATEST(wallet_balance, 1.00), updated_at = NOW()
WHERE (username ILIKE '%test056%' OR email ILIKE '%test056%')
  AND (wallet_balance IS NULL OR wallet_balance < 1);

-- Log the fix for test056
INSERT INTO credit_transactions (user_id, amount, balance_after, type, status, description, metadata)
SELECT
  clerk_user_id,
  0,
  credits,
  'credit_refund',
  'success',
  'Wallet fix: restored $1 locked balance (payment processed before wallet system)',
  '{"fix_reason": "wallet_balance_zero_after_payment", "paid_total_usd": 1, "restored_wallet": 1.00}'::jsonb
FROM users
WHERE (username ILIKE '%test056%' OR email ILIKE '%test056%')
  AND wallet_balance = 1.00;

-- Step 5: Verify fix
SELECT clerk_user_id, username, credits, wallet_balance
FROM users WHERE clerk_user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ';
