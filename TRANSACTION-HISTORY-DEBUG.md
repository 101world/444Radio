# Transaction History Debugging

**Issue:** User reports that transaction history on pricing page should show credit purchases (wallet deposits) but they're not appearing.

## Diagnostic Steps

### 1. Verify Migration 121 Applied

Migration 121 adds `wallet_deposit` and `wallet_conversion` to the credit_transactions type constraint.

**Check in Supabase SQL Editor:**
```sql
SELECT
  constraint_name,
  check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'credit_transactions_type_check';
```

**Expected:** Should see wallet_deposit and wallet_conversion in the CHECK clause.

### 2. Check If Wallet Deposits Are Being Logged

```sql
SELECT COUNT(*) as deposit_count
FROM credit_transactions
WHERE type = 'wallet_deposit';
```

**If 0:** Transactions aren't being logged. Check:
- Is migration 121 actually applied?
- Are there errors in the verify/webhook logs?
- Is the constraint still blocking inserts?

**If > 0:** Transactions ARE being logged. Check:
- Are they for the correct user?
- Is the API returning them?
- Is the UI hiding them?

### 3. Test Transaction History API

**In browser console on pricing page:**
```javascript
fetch('/api/credits/history?limit=50')
  .then(r => r.json())
  .then(data => {
    console.log('Total transactions:', data.total)
    console.log('Wallet deposits:', data.transactions.filter(t => t.type === 'wallet_deposit'))
    console.table(data.transactions)
  })
```

**Expected:** Should see wallet_deposit transactions in the response.

### 4. Check User's Actual Transaction History

Replace `user_xxx` with actual Clerk user ID:
```sql
SELECT
  type,
  amount,
  description,
  status,
  created_at
FROM credit_transactions
WHERE user_id = 'user_xxx'
ORDER BY created_at DESC
LIMIT 20;
```

## Possible Causes

### A. Migration 121 Not Applied Yet
- **Symptom:** No wallet_deposit transactions in database at all
- **Fix:** Apply migration 121 in Supabase SQL Editor
- **File:** `db/migrations/121_add_wallet_types_to_constraint.sql`

### B. Transactions Logged Before Migration 121
- **Symptom:** Wallet deposits exist but very old dates (before Feb 15, 2026)
- **Fix:** These failed to log due to constraint. Make a test deposit to verify new ones work.

### C. API Not Returning Transactions
- **Symptom:** Transactions exist in DB but API returns empty
- **Fix:** Check `/api/credits/history` route, verify it's not filtering wallet_deposit

### D. UI Not Displaying Them
- **Symptom:** API returns wallet_deposit but UI doesn't show them
- **Fix:** Check TYPE_LABELS in pricing page, verify wallet_deposit is defined

## Current Implementation Status

### TYPE_LABELS (pricing page)
```typescript
wallet_deposit: { label: 'Deposit', color: 'text-green-400' },
wallet_conversion: { label: 'Converted', color: 'text-cyan-400' },
```
✅ Defined

### API Endpoint
`/api/credits/history` - Fetches all transaction types without filtering
✅ Should work

### Transaction Logging
`lib/credit-transactions.ts` - `logCreditTransaction()` function
✅ Implemented

### Verify Route
`/app/api/credits/verify/route.ts` - Logs wallet_deposit after successful payment
✅ Implemented

### Webhook
`/app/api/webhooks/razorpay/route.ts` - Logs wallet_deposit after payment.captured
✅ Implemented

## Quick Fixes

### If Migration 121 Not Applied
1. Open Supabase SQL Editor
2. Copy `db/migrations/121_add_wallet_types_to_constraint.sql`
3. Run the SQL
4. Make a test deposit to verify it logs

### If Transactions Exist But Not Showing
1. Open browser console on `/pricing` page
2. Run the fetch test above
3. Check response for wallet_deposit transactions
4. If present in API but not UI, check browser console for React errors

### If Deposits Made Before Feb 15, 2026
These failed silently due to missing constraint. User needs to:
1. Make a small test deposit ($2) after migration 121 is applied
2. Check transaction history to confirm it appears
3. Previous deposits are lost (can't be recovered)

## Verification Checklist

- [ ] Migration 121 applied in Supabase
- [ ] Constraint allows wallet_deposit type
- [ ] Test deposit made after migration
- [ ] Transaction appears in credit_transactions table
- [ ] API returns transaction in /api/credits/history
- [ ] UI displays transaction in pricing page history
- [ ] Description shows "Wallet deposit: +$X → Y credits"
- [ ] Amount shows as positive (green, with ArrowDownRight icon)
- [ ] Label shows "Deposit" in green color

## Related Files

- `/db/migrations/121_add_wallet_types_to_constraint.sql` - Adds wallet types to constraint
- `/app/api/credits/history/route.ts` - Transaction history API
- `/app/pricing/page.tsx` - UI display (TYPE_LABELS, transaction list)
- `/lib/credit-transactions.ts` - Logging function
- `/app/api/credits/verify/route.ts` - Instant verification (logs deposit)
- `/app/api/webhooks/razorpay/route.ts` - Payment webhook (logs deposit)

---

**Next Steps:**
1. Run check-wallet-deposit-transactions.sql in Supabase
2. Verify migration 121 is applied
3. Make test deposit if needed
4. Check browser console for API response
