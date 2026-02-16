-- ============================================================================
-- Complete Credit Flow Audit - Where are credits coming from?
-- Run in Supabase SQL Editor
-- ============================================================================

-- 1. All credit sources breakdown (last 30 days)
SELECT
  type,
  COUNT(*) as transaction_count,
  SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_credits_added,
  SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_credits_spent,
  MIN(created_at) as first_transaction,
  MAX(created_at) as last_transaction
FROM credit_transactions
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY type
ORDER BY total_credits_added DESC NULLS LAST;

-- 2. New user onboarding credits (last 7 days)
SELECT
  u.clerk_user_id,
  u.email,
  u.credits,
  u.created_at as signup_date,
  COUNT(ct.id) as transaction_count,
  COALESCE(SUM(ct.amount), 0) as total_credits_received
FROM users u
LEFT JOIN credit_transactions ct ON ct.user_id = u.clerk_user_id
WHERE u.created_at > NOW() - INTERVAL '7 days'
GROUP BY u.clerk_user_id, u.email, u.credits, u.created_at
ORDER BY u.created_at DESC;

-- 3. Check for any "free" credits (no payment required)
SELECT
  user_id,
  type,
  amount,
  description,
  metadata,
  created_at
FROM credit_transactions
WHERE type IN ('credit_award', 'code_claim', 'subscription_bonus')
  AND created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

-- 4. Wallet deposits vs credits received
SELECT
  u.email,
  u.wallet_balance,
  u.credits,
  COUNT(ct.id) FILTER (WHERE ct.type = 'wallet_deposit') as deposit_count,
  SUM(ct.amount) FILTER (WHERE ct.type = 'wallet_deposit') as deposit_credits,
  COUNT(ct.id) FILTER (WHERE ct.type = 'wallet_conversion') as conversion_count,
  SUM(ct.amount) FILTER (WHERE ct.type = 'wallet_conversion') as conversion_credits
FROM users u
LEFT JOIN credit_transactions ct ON ct.user_id = u.clerk_user_id
  AND ct.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.clerk_user_id, u.email, u.wallet_balance, u.credits
HAVING COUNT(ct.id) > 0
ORDER BY deposit_credits DESC NULLS LAST;

-- 5. Earn marketplace: listing + purchase + sale credits
SELECT
  u.email,
  COUNT(ct.id) FILTER (WHERE ct.type = 'earn_list') as listings,
  SUM(ct.amount) FILTER (WHERE ct.type = 'earn_list') as listing_credits_spent,
  COUNT(ct.id) FILTER (WHERE ct.type = 'earn_purchase') as purchases,
  SUM(ct.amount) FILTER (WHERE ct.type = 'earn_purchase') as purchase_credits_spent,
  COUNT(ct.id) FILTER (WHERE ct.type = 'earn_sale') as sales,
  SUM(ct.amount) FILTER (WHERE ct.type = 'earn_sale') as sale_credits_earned,
  COUNT(ct.id) FILTER (WHERE ct.type = 'earn_admin') as admin_fees,
  SUM(ct.amount) FILTER (WHERE ct.type = 'earn_admin') as admin_credits_earned
FROM users u
LEFT JOIN credit_transactions ct ON ct.user_id = u.clerk_user_id
  AND ct.type IN ('earn_list', 'earn_purchase', 'earn_sale', 'earn_admin')
  AND ct.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.clerk_user_id, u.email
HAVING COUNT(ct.id) > 0
ORDER BY sales DESC;

-- 6. Check for users with credits but NO transactions (potential leak)
SELECT
  u.clerk_user_id,
  u.email,
  u.credits,
  u.total_generated,
  u.created_at as signup_date,
  COUNT(ct.id) as transaction_count
FROM users u
LEFT JOIN credit_transactions ct ON ct.user_id = u.clerk_user_id
WHERE u.credits > 0
GROUP BY u.clerk_user_id, u.email, u.credits, u.total_generated, u.created_at
HAVING COUNT(ct.id) = 0
ORDER BY u.credits DESC
LIMIT 20;

-- 7. Check decrypt code claims (should be 20 credits once per user)
SELECT
  user_id,
  COUNT(*) as decrypt_claims,
  SUM(amount) as total_decrypt_credits,
  MIN(created_at) as first_claim,
  MAX(created_at) as last_claim
FROM credit_transactions
WHERE type = 'code_claim'
  AND (description LIKE '%decrypt%' OR description LIKE '%code%')
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY decrypt_claims DESC;

-- 8. PayPal subscription bonuses (legacy - should be none for new users)
SELECT
  user_id,
  COUNT(*) as paypal_bonuses,
  SUM(amount) as total_paypal_credits,
  MAX(created_at) as last_bonus
FROM credit_transactions
WHERE type = 'subscription_bonus'
  AND (metadata->>'credit_source' = 'paypal' OR metadata->>'paypal_subscription_id' IS NOT NULL)
GROUP BY user_id
ORDER BY last_bonus DESC;

-- 9. Generation costs verification (negative amounts)
SELECT
  REPLACE(type, 'generation_', '') as generation_type,
  COUNT(*) as generations,
  AVG(ABS(amount)) as avg_credit_cost,
  MIN(ABS(amount)) as min_cost,
  MAX(ABS(amount)) as max_cost,
  SUM(ABS(amount)) as total_credits_spent
FROM credit_transactions
WHERE type LIKE 'generation_%'
  AND amount < 0
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY type
ORDER BY generations DESC;

-- 10. SUMMARY: Credit sources ranked by total credits added
SELECT
  CASE
    WHEN type = 'wallet_deposit' THEN '💳 Wallet Deposits (Paid)'
    WHEN type = 'wallet_conversion' THEN '💳 Wallet Conversions'
    WHEN type = 'code_claim' THEN '🔓 Decrypt Code (20cr once)'
    WHEN type = 'credit_award' THEN '🎁 Admin Awards'
    WHEN type = 'subscription_bonus' THEN '💎 Subscription Bonus (Legacy PayPal)'
    WHEN type = 'earn_sale' THEN '💰 Earn Marketplace Sales'
    WHEN type = 'earn_admin' THEN '💼 Earn Admin Fees'
    WHEN type LIKE 'generation_%' THEN '🎵 Generation Spent'
    WHEN type LIKE 'earn_%' AND type NOT IN ('earn_sale', 'earn_admin') THEN '🛒 Earn Marketplace Costs'
    ELSE type
  END as source,
  COUNT(*) as count,
  SUM(amount) as net_credits,
  SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as credits_added,
  SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as credits_spent
FROM credit_transactions
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY type
ORDER BY credits_added DESC NULLS LAST;
