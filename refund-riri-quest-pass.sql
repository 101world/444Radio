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

-- Step 6: Delete any orphaned/invalid quest passes for riri
DELETE FROM quest_passes
WHERE user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ'
  AND credits_spent <= 1;

-- Step 7: Verify
SELECT clerk_user_id, username, credits, wallet_balance
FROM users WHERE clerk_user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ';
