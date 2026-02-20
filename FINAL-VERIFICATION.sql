-- FINAL VERIFICATION: Check system health after rollback

-- 1. Check all users who redeemed the code have correct credits
SELECT 
    COUNT(*) as total_users,
    AVG(free_credits) as avg_free_credits,
    MIN(free_credits) as min_free_credits,
    MAX(free_credits) as max_free_credits
FROM users
WHERE clerk_user_id IN (
    SELECT DISTINCT user_id 
    FROM credit_transactions 
    WHERE description LIKE '%Free the Music%'
);
-- Expected: avg/min/max should all be 24

-- 2. Check transaction counts (should be 1 per user)
SELECT 
    user_id,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount
FROM credit_transactions
WHERE description LIKE '%Free the Music%'
  AND metadata->>'campaign' = 'free_the_music'
  AND amount > 0
GROUP BY user_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows (no duplicates)

-- 3. Check system discrepancy (444B admin allocation)
SELECT 
    clerk_user_id,
    credits + COALESCE(free_credits, 0) as total_credits,
    logged_transactions,
    transaction_sum,
    (credits + COALESCE(free_credits, 0)) - transaction_sum as discrepancy
FROM (
    SELECT 
        u.clerk_user_id,
        u.credits,
        u.free_credits,
        COUNT(ct.id) as logged_transactions,
        COALESCE(SUM(ct.amount), 0) as transaction_sum
    FROM users u
    LEFT JOIN credit_transactions ct ON u.clerk_user_id = ct.user_id
    GROUP BY u.clerk_user_id, u.credits, u.free_credits
) subquery
WHERE clerk_user_id IN (
    SELECT DISTINCT user_id 
    FROM credit_transactions 
    WHERE description LIKE '%Free the Music%'
)
ORDER BY discrepancy DESC
LIMIT 10;
-- Should show reasonable discrepancies (historical usage before bulletproof system)

-- 4. Count total free credits distributed
SELECT 
    SUM(free_credits) as total_free_credits_in_system,
    COUNT(*) as users_with_free_credits,
    444000000000 - SUM(free_credits) as remaining_admin_pool
FROM users
WHERE free_credits > 0;
-- Shows how many credits distributed from 444B pool

-- 5. Sample of users showing final state
SELECT 
    clerk_user_id,
    credits as paid,
    free_credits as free,
    (credits + COALESCE(free_credits, 0)) as total,
    (SELECT COUNT(*) 
     FROM credit_transactions 
     WHERE user_id = users.clerk_user_id 
       AND description LIKE '%Free the Music%'
       AND amount > 0) as free_music_txn_count
FROM users
WHERE free_credits > 0
ORDER BY clerk_user_id
LIMIT 30;
-- Final confirmation: All should show 24 free credits, 1 transaction
