-- ============================================================
-- REFUND RIRI 2 CREDITS — Failed Quest Pass Purchases
-- User: riri (user_34LKhAX7aYSnMboQLn5S8vVbzoQ)
-- Date: 2026-02-16
-- ============================================================

-- Step 1: Check current state
SELECT clerk_user_id, username, credits, wallet_balance
FROM users WHERE clerk_user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ';

-- Step 2: Check any quest_entry transactions  
SELECT id, user_id, amount, balance_after, type, status, description, created_at
FROM credit_transactions
WHERE user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ'
  AND type = 'quest_entry'
ORDER BY created_at DESC;

-- Step 3: Check any quest passes created
SELECT * FROM quest_passes
WHERE user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ'
ORDER BY created_at DESC;

-- Step 4: Refund 2 credits
UPDATE users
SET credits = credits + 2, updated_at = NOW()
WHERE clerk_user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ';

-- Step 5: Log the refund
INSERT INTO credit_transactions (user_id, amount, balance_after, type, status, description, metadata)
VALUES (
  'user_34LKhAX7aYSnMboQLn5S8vVbzoQ',
  2,
  (SELECT credits FROM users WHERE clerk_user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ'),
  'credit_refund',
  'success',
  'Refund: 2 credits for failed Quest Pass purchases (old 1-credit code ran before fix deployed)',
  '{"refund_reason": "quest_pass_purchase_failed_twice", "original_cost": 1, "count": 2}'::jsonb
);

-- Step 6: Delete any orphaned/invalid quest passes for riri (created by old buggy code)
DELETE FROM quest_passes
WHERE user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ';

-- Step 7: Verify riri
SELECT clerk_user_id, username, credits, wallet_balance
FROM users WHERE clerk_user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ';

-- ============================================================
-- CHECK ALL PAYING USERS — anyone with wallet_deposit transactions
-- ============================================================

-- Step 8: Find ALL users who ever deposited real money
SELECT DISTINCT
  u.clerk_user_id,
  u.username,
  u.email,
  u.credits,
  u.wallet_balance,
  u.total_generated,
  ct.total_deposits,
  ct.total_deposit_usd
FROM users u
JOIN (
  SELECT 
    user_id,
    COUNT(*) as total_deposits,
    SUM(COALESCE((metadata->>'deposit_usd')::numeric, 0)) as total_deposit_usd
  FROM credit_transactions
  WHERE type = 'wallet_deposit' AND status = 'success'
  GROUP BY user_id
) ct ON u.clerk_user_id = ct.user_id
ORDER BY ct.total_deposit_usd DESC;

-- Step 9: Also check credit_award transactions (old payment system gave credits directly)
SELECT DISTINCT
  u.clerk_user_id,
  u.username,
  u.email,
  u.credits,
  u.wallet_balance,
  ct.type,
  ct.amount,
  ct.description,
  ct.created_at
FROM users u
JOIN credit_transactions ct ON u.clerk_user_id = ct.user_id
WHERE ct.type IN ('wallet_deposit', 'credit_award', 'subscription_bonus')
  AND ct.status = 'success'
ORDER BY ct.created_at DESC;

-- Step 10: Fix ALL users who deposited money but have wallet_balance = 0
-- Set to $1 locked minimum
UPDATE users
SET wallet_balance = 1.00, updated_at = NOW()
WHERE clerk_user_id IN (
  SELECT DISTINCT user_id FROM credit_transactions
  WHERE type = 'wallet_deposit' AND status = 'success'
)
AND (wallet_balance IS NULL OR wallet_balance < 1);

-- Step 11: Verify all paying users now have $1+
SELECT clerk_user_id, username, credits, wallet_balance
FROM users
WHERE clerk_user_id IN (
  SELECT DISTINCT user_id FROM credit_transactions
  WHERE type = 'wallet_deposit' AND status = 'success'
)
ORDER BY wallet_balance DESC;
