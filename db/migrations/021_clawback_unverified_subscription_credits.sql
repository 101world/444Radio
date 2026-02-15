-- ══════════════════════════════════════════════════════════════════════════
-- 021: Identify & claw back subscription credits awarded without active sub
-- Run this MANUALLY after reviewing the SELECT output first!
-- ══════════════════════════════════════════════════════════════════════════

-- STEP 1: REVIEW — Find users who got subscription_bonus credits
-- but whose subscription is NOT currently active
-- Run this SELECT first to see who's affected BEFORE doing clawback

SELECT 
    u.clerk_user_id,
    u.email,
    u.username,
    u.subscription_status,
    u.subscription_plan,
    u.subscription_id,
    u.credits AS current_credits,
    ct.amount AS bonus_amount,
    ct.description,
    ct.created_at AS bonus_awarded_at,
    ct.metadata->>'razorpay_id' AS razorpay_id,
    ct.metadata->>'paid_count' AS paid_count,
    ct.metadata->>'credit_source' AS credit_source
FROM credit_transactions ct
JOIN users u ON u.clerk_user_id = ct.user_id
WHERE ct.type = 'subscription_bonus'
  AND ct.status = 'success'
  AND u.subscription_status NOT IN ('active')
ORDER BY ct.created_at DESC;


-- STEP 2: CLAWBACK — Deduct the unearned credits
-- ONLY run this AFTER reviewing Step 1 output!
-- Uncomment the lines below when ready to execute.

/*
-- For each affected user, deduct the bonus and log a clawback transaction
WITH unearned AS (
    SELECT 
        ct.user_id,
        SUM(ct.amount) AS total_unearned,
        u.credits AS current_credits
    FROM credit_transactions ct
    JOIN users u ON u.clerk_user_id = ct.user_id
    WHERE ct.type = 'subscription_bonus'
      AND ct.status = 'success'
      AND u.subscription_status NOT IN ('active')
      -- Only look at recent transactions (last 60 days)
      AND ct.created_at > NOW() - INTERVAL '60 days'
    GROUP BY ct.user_id, u.credits
)
UPDATE users 
SET credits = GREATEST(0, users.credits - unearned.total_unearned),
    updated_at = NOW()
FROM unearned
WHERE users.clerk_user_id = unearned.user_id;
*/

-- STEP 3: Log the clawback transactions for audit trail
-- Run AFTER Step 2

/*
INSERT INTO credit_transactions (user_id, amount, balance_after, type, status, description, metadata, created_at)
SELECT 
    u.clerk_user_id,
    -SUM(ct.amount),
    GREATEST(0, u.credits - SUM(ct.amount)),
    'admin_adjustment',
    'success',
    'Clawback: subscription credits awarded without active payment',
    jsonb_build_object(
        'reason', 'subscription_not_active_clawback',
        'subscription_status', u.subscription_status,
        'total_clawed_back', SUM(ct.amount),
        'original_balance', u.credits
    ),
    NOW()
FROM credit_transactions ct
JOIN users u ON u.clerk_user_id = ct.user_id
WHERE ct.type = 'subscription_bonus'
  AND ct.status = 'success'
  AND u.subscription_status NOT IN ('active')
  AND ct.created_at > NOW() - INTERVAL '60 days'
GROUP BY u.clerk_user_id, u.credits, u.subscription_status;
*/
