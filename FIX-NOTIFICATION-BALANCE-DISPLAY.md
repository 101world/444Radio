# Fix: Notifications showing only free_credits (24) instead of total (35)

## Problem
User "stimit" has:
- 11 paid credits
- 24 free credits  
- **Total: 35 credits**

But notifications show: "available balance 24" (only free_credits)
Admin dashboard also shows 24 instead of 35.

## Root Cause
When notifications/admin display credit balances, they're fetching **only `free_credits`** instead of `credits + free_credits`.

## Solution

### Step 1: Run Diagnostic
Run [DEBUG-STIMIT-NOTIFICATIONS.sql](DEBUG-STIMIT-NOTIFICATIONS.sql) to see what's stored in notifications.

### Step 2: Find where balance is displayed

The issue is likely in one of these places:
1. **Notification creation** - when notification is created, balance might be stored incorrectly
2. **Notification display** - when notification is shown, balance might be fetched incorrectly  
3. **Admin dashboard** - when admin views user, balance query is wrong

### Step 3: Update notification library

The notification functions need to:
1. Fetch BOTH paid + free credits when creating notifications
2. Store total_balance in notification data
3. Display total in message

**File to update:** `lib/notifications.ts`

Change this:
```ts
export async function notifyCreditAward(userId: string, credits: number, reason: string) {
  return createNotification({
    userId,
    type: 'credit_award',
    data: { credits, reason, message: `Awarded ${credits} credits: ${reason}` }
  });
}
```

To this:
```ts
export async function notifyCreditAward(userId: string, creditsAwarded: number, totalBalance: number, paidCredits: number, freeCredits: number, reason: string) {
  return createNotification({
    userId,
    type: 'credit_award',
    data: { 
      creditsAwarded, 
      totalBalance,
      paidCredits,
      freeCredits,
      reason, 
      message: `Awarded ${creditsAwarded} credits! Total available: ${totalBalance} (${paidCredits} paid + ${freeCredits} free)` 
    }
  });
}
```

### Step 4: Update callers

Wherever `notifyCreditAward` is called, pass total balance:
```ts
// Before (wrong):
await notifyCreditAward(userId, 24, 'Free the Music upgrade')

// After (correct):
const { data: user } = await supabase.from('users').select('credits, free_credits').eq('clerk_user_id', userId).single()
const total = (user?.credits || 0) + (user?.free_credits || 0)
await notifyCreditAward(userId, 24, total, user?.credits || 0, user?.free_credits || 0, 'Free the Music upgrade')
```

### Step 5: Admin dashboard fix

Check admin dashboard query - probably selecting only `free_credits` instead of total.

**File to check:** `app/adminrizzog/page.tsx` or wherever admin views user credits.

Change from:
```sql
SELECT free_credits as balance
```

To:
```sql
SELECT credits + COALESCE(free_credits, 0) as balance
```

## Files to Update
1. `lib/notifications.ts` - Update notifyCreditAward signature
2. `app/api/credits/award/route.ts` - Pass total balance when creating notification
3. `app/api/wallet/convert/route.ts` - Pass total balance when creating notification  
4. `app/adminrizzog/page.tsx` - Display total credits in admin view
5. Any other places calling notifyCreditAward

## Verification
After fix, notifications should show:
```
Awarded 24 credits! Total available: 35 (11 paid + 24 free)
```

Instead of:
```
Awarded 24 credits (available balance 24)
```
