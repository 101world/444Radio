# 🚨 FIX: Credit Duplication Issue

## What Happened
- Credits jumped from **11 → 83** (72 extra instead of 24)
- Migration 132 failed: "function name 'notify_admin' is not unique"
- Migration 131 likely ran multiple times or awarded duplicates

---

## Fix Steps (Run in Order)

### Step 1: Check the Damage
Run [DIAGNOSTIC-CHECK-CREDITS.sql](DIAGNOSTIC-CHECK-CREDITS.sql) to see:
- How many times each user was awarded
- If there are duplicate code redemptions
- Current credit balances

Expected result: You'll see each user got **72 credits** (24 × 3 times) instead of 24.

---

### Step 2: Rollback Duplicate Credits
Run [ROLLBACK-DUPLICATE-CREDITS.sql](ROLLBACK-DUPLICATE-CREDITS.sql)

This will:
- Find users who got more than 24 credits
- Remove excess credits from `free_credits` column
- Delete duplicate transaction records (keeps first one only)
- Log correction transactions

**After this:** Users should have **11 paid + 24 free = 35 total** ✅

---

### Step 3: Run Fixed Migration 132
Run [STEP-1-FIXED-MIGRATION-132.sql](STEP-1-FIXED-MIGRATION-132.sql)

**What's fixed:**
- Drops ALL versions of `notify_admin()` first to avoid signature conflicts
- Creates bulletproof tracking system with correct signatures

**Verify it worked:**
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN ('award_credits', 'notify_admin', 'audit_untracked_credits')
  AND routine_schema = 'public';
-- Should return 3 rows
```

---

### Step 4: Skip Migration 131 (Already Done)
⚠️ **DO NOT RUN** [STEP-2-FIXED-MIGRATION-131.sql](STEP-2-FIXED-MIGRATION-131.sql)

Why? Users already have their 24 credits (after rollback in Step 2). Running this again would duplicate them again.

The fixed version checks for existing awards before granting, but unnecessary since rollback already corrected everything.

---

### Step 5: Run Migration 133 (Admin Notification)
Run [STEP-3-ADMIN-NOTIFICATION.sql](STEP-3-ADMIN-NOTIFICATION.sql)

Sends admin summary:
- Users upgraded count
- Total credits distributed: 240 (10 users × 24 credits)
- 444B pool status

---

## Verification Queries

**Check credits are correct:**
```sql
SELECT 
  clerk_user_id,
  credits as paid,
  free_credits as free,
  (credits + COALESCE(free_credits, 0)) as total
FROM users
WHERE clerk_user_id IN (
  SELECT DISTINCT clerk_user_id FROM code_redemptions WHERE code = 'FREE THE MUSIC'
)
ORDER BY total DESC;
-- Should show: 11 paid + 24 free = 35 total for each user
```

**Check transactions are clean:**
```sql
SELECT 
  user_id,
  COUNT(*) as transaction_count,
  SUM(amount) as total_awarded
FROM credit_transactions
WHERE description LIKE '%Free the Music%'
  AND metadata->>'campaign' = 'free_the_music'
  AND amount > 0
GROUP BY user_id;
-- Should show: 1 transaction, 24 credits per user
```

**Check 444B pool:**
```sql
SELECT * FROM credit_audit_summary;
-- Discrepancy should be 0 or close to 0
```

---

## Summary

**Before:**
- 11 credits displayed (missing free_credits)
- 83 actual (72 duplicates)

**After Fix:**
- 35 credits displayed (11 paid + 24 free)
- Transactions cleaned up
- Bulletproof system in place
- Admin notified

---

## If Something Goes Wrong

**Rollback didn't work?**
```sql
-- Manual rollback: Set free_credits back to 0
UPDATE users 
SET free_credits = 0 
WHERE clerk_user_id IN (
  SELECT DISTINCT clerk_user_id FROM code_redemptions WHERE code = 'FREE THE MUSIC'
);
```

**Want to start fresh?**
```sql
-- Delete all Free the Music transactions
DELETE FROM credit_transactions 
WHERE description LIKE '%Free the Music%'
  AND metadata->>'campaign' = 'free_the_music';
  
-- Reset free_credits
UPDATE users SET free_credits = 0;
```

Then run migrations 132 → 131 → 133 in order.
