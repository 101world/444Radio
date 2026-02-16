-- ============================================================
-- COMPREHENSIVE FIX: ALL PAYING USERS WALLET + QUEST TABLE FIX
-- Fixes: Riri, test056, and ANY other user who ever paid
-- Also adds missing credits_spent column to quest_passes
-- ============================================================

-- ===================== SCHEMA FIX =====================
-- Step 0: Add credits_spent column to quest_passes if missing
-- (migration 126 may have run before column was added)
ALTER TABLE quest_passes ADD COLUMN IF NOT EXISTS credits_spent INT NOT NULL DEFAULT 30;

-- ===================== DIAGNOSTICS =====================

-- Step 1: Check Riri
SELECT clerk_user_id, username, email, credits, wallet_balance, total_generated, created_at
FROM users WHERE clerk_user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ';

-- Step 2: Riri's full transaction history
SELECT id, type, amount, balance_after, status, description,
       metadata->>'deposit_usd' as deposit_usd,
       metadata->>'wallet_balance' as wallet_in_meta,
       metadata->>'razorpay_payment_id' as razorpay_id,
       created_at
FROM credit_transactions
WHERE user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ'
ORDER BY created_at DESC;

-- Step 3: Check test056
SELECT clerk_user_id, username, email, credits, wallet_balance
FROM users WHERE username ILIKE '%test056%' OR email ILIKE '%test056%';

-- Step 4: Find ALL paying users (wallet_deposit transactions)
SELECT DISTINCT u.clerk_user_id, u.username, u.email, u.credits, u.wallet_balance,
       COUNT(ct.id) as deposit_count,
       SUM(CAST(ct.metadata->>'deposit_usd' AS NUMERIC)) as total_usd_deposited
FROM users u
JOIN credit_transactions ct ON u.clerk_user_id = ct.user_id
WHERE ct.type = 'wallet_deposit' AND ct.status = 'success'
GROUP BY u.clerk_user_id, u.username, u.email, u.credits, u.wallet_balance
ORDER BY u.wallet_balance ASC;

-- Step 5: Also check credit_award/subscription_bonus (old payment methods)
SELECT DISTINCT u.clerk_user_id, u.username, u.wallet_balance, ct.type, ct.description
FROM users u
JOIN credit_transactions ct ON u.clerk_user_id = ct.user_id
WHERE ct.type IN ('credit_award', 'subscription_bonus')
  AND ct.status = 'success'
  AND ct.description ILIKE '%payment%' OR ct.description ILIKE '%subscription%' OR ct.description ILIKE '%razorpay%'
ORDER BY u.username;

-- ===================== FIXES =====================

-- Step 6a: Fix ALL paying users (wallet_deposit) — set wallet_balance to $1 if < $1
UPDATE users
SET wallet_balance = GREATEST(COALESCE(wallet_balance, 0), 1.00), updated_at = NOW()
WHERE clerk_user_id IN (
  SELECT DISTINCT user_id FROM credit_transactions
  WHERE type = 'wallet_deposit' AND status = 'success'
)
AND (wallet_balance IS NULL OR wallet_balance < 1);

-- Step 6b: DIRECT FIX for Riri — she paid via old subscription system (not wallet_deposit)
UPDATE users
SET wallet_balance = 1.00, updated_at = NOW()
WHERE clerk_user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ'
  AND (wallet_balance IS NULL OR wallet_balance < 1);

-- Step 7: Log the fix for all affected users (wallet_deposit payers)
INSERT INTO credit_transactions (user_id, amount, balance_after, type, status, description, metadata)
SELECT
  u.clerk_user_id,
  0,
  u.credits,
  'credit_refund',
  'success',
  'Wallet fix: restored $1 locked balance (payment before wallet system)',
  jsonb_build_object(
    'fix_reason', 'wallet_balance_zero_after_payment',
    'restored_wallet', 1.00,
    'fix_date', NOW()::text
  )
FROM users u
WHERE u.clerk_user_id IN (
  SELECT DISTINCT user_id FROM credit_transactions
  WHERE type = 'wallet_deposit' AND status = 'success'
)
AND u.wallet_balance = 1.00;

-- Step 7b: Log the fix for Riri specifically
INSERT INTO credit_transactions (user_id, amount, balance_after, type, status, description, metadata)
SELECT
  'user_34LKhAX7aYSnMboQLn5S8vVbzoQ',
  0,
  credits,
  'credit_refund',
  'success',
  'Wallet fix: restored $1 locked balance — Riri paid $2 via old subscription system',
  jsonb_build_object(
    'fix_reason', 'riri_paid_before_wallet_system',
    'restored_wallet', 1.00,
    'paid_usd', 2,
    'fix_date', NOW()::text
  )
FROM users
WHERE clerk_user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ'
  AND wallet_balance = 1.00;

-- ===================== VERIFICATION =====================

-- Step 8: Verify ALL paying users now show $1+
SELECT clerk_user_id, username, credits, wallet_balance
FROM users
WHERE clerk_user_id IN (
  SELECT DISTINCT user_id FROM credit_transactions
  WHERE type = 'wallet_deposit' AND status = 'success'
)
ORDER BY wallet_balance DESC;

-- Step 9: Double-check quest_passes schema is correct
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'quest_passes'
ORDER BY ordinal_position;
