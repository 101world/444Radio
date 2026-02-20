-- CHECK STIMIT'S FULL CREDITS AND NOTIFICATIONS

-- 1. Check stimit's credits and free_credits
SELECT 
    clerk_user_id,
    credits as paid_credits,
    free_credits,
    (credits + COALESCE(free_credits, 0)) as total_balance,
    wallet_balance,
    created_at
FROM users
WHERE clerk_user_id = 'user_39qZno2Kce4PEd5aT1zWY4cR1bS';
-- Expected: 11 paid + 24 free = 35 total

-- 2. Check stimit's recent notifications (see what message is shown)
SELECT *
FROM notifications
WHERE user_id = 'user_39qZno2Kce4PEd5aT1zWY4cR1bS'
ORDER BY created_at DESC
LIMIT 10;
-- Look for "available balance 24" message - this is the bug

-- 3. Check stimit's recent credit transactions
SELECT 
    id,
    amount,
    balance_after,
    type,
    description,
    metadata,
    created_at
FROM credit_transactions
WHERE user_id = 'user_39qZno2Kce4PEd5aT1zWY4cR1bS'
ORDER BY created_at DESC
LIMIT 10;
-- See what balance_after values are being logged
