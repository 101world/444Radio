-- Fix rizz (admin) wallet: $4 → $2 (double deposit from race condition)
-- Admin Clerk ID: user_34StnaXDJ3yZTYmz1Wmv3sYcqcB

-- Step 1: Check current state
SELECT clerk_user_id, username, email, credits, wallet_balance
FROM users WHERE clerk_user_id = 'user_34StnaXDJ3yZTYmz1Wmv3sYcqcB';

-- Step 2: Check wallet_deposit transactions (should show duplicates)
SELECT id, type, amount, description, 
       metadata->>'razorpay_id' as razorpay_id,
       metadata->>'razorpay_payment_id' as payment_id,
       metadata->>'order_id' as order_id,
       metadata->>'deposit_usd' as deposit_usd,
       metadata->>'wallet_balance' as wallet_after,
       metadata->>'event_type' as event_type,
       metadata->>'credit_source' as source,
       created_at
FROM credit_transactions
WHERE user_id = 'user_34StnaXDJ3yZTYmz1Wmv3sYcqcB'
  AND type = 'wallet_deposit'
  AND status = 'success'
ORDER BY created_at DESC;

-- Step 3: Fix wallet balance — should be $2, not $4
UPDATE users
SET wallet_balance = 2.00, updated_at = NOW()
WHERE clerk_user_id = 'user_34StnaXDJ3yZTYmz1Wmv3sYcqcB'
  AND wallet_balance > 2;

-- Step 4: Log the correction
INSERT INTO credit_transactions (user_id, amount, balance_after, type, status, description, metadata)
SELECT
  'user_34StnaXDJ3yZTYmz1Wmv3sYcqcB',
  0,
  credits,
  'credit_refund',
  'success',
  'Wallet correction: $4 → $2 (duplicate deposit from verify+webhook race condition)',
  jsonb_build_object(
    'fix_reason', 'double_deposit_race_condition',
    'old_wallet', 4.00,
    'new_wallet', 2.00,
    'fix_date', NOW()::text
  )
FROM users
WHERE clerk_user_id = 'user_34StnaXDJ3yZTYmz1Wmv3sYcqcB';

-- Step 5: Verify
SELECT clerk_user_id, username, credits, wallet_balance
FROM users WHERE clerk_user_id = 'user_34StnaXDJ3yZTYmz1Wmv3sYcqcB';
