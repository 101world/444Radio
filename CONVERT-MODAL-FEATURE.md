# Convert Wallet Modal Feature

**Status:** ✅ Deployed (commit `950c010`)  
**Date:** Feb 16, 2026

## Overview

Added a modal dialog for converting wallet balance to credits with currency-aware display (INR for Indians, USD for US users) and flexible amount input.

## Changes Made

### 1. API Endpoint Update
**File:** `app/api/credits/convert/route.ts`

**Before:**
- Hardcoded to convert ALL wallet balance (`p_amount_usd: null`)
- No amount validation

**After:**
- Accepts `amount_usd` from request body
- Validates amount (must be > 0, cannot exceed wallet balance)
- Supports partial conversions via the `p_amount_usd` parameter
- Returns `amountConverted` in response for accurate display

**Key Changes:**
```typescript
const body = await request.json()
const amountUsd = body.amount_usd ? parseFloat(body.amount_usd) : null

// Validate amount if specified
if (amountUsd !== null) {
  if (amountUsd <= 0) { /* error */ }
  if (amountUsd > currentWallet) { /* error */ }
}

// Call RPC with dynamic amount
await supabaseAdmin.rpc('convert_wallet_to_credits', {
  p_clerk_user_id: userId,
  p_amount_usd: amountUsd, // null = convert all, otherwise specific amount
})
```

### 2. Modal UI Component
**File:** `app/pricing/page.tsx`

**New State:**
- `showConvertModal`: boolean for modal visibility
- `convertAmount`: string for user input amount

**Modal Features:**
1. **Currency-aware display:**
   - Shows wallet balance in INR (₹) or USD ($) based on user's currency preference
   - Conversion rate display: `₹3.19` or `$0.035` per credit

2. **Amount input:**
   - Number input with min/max validation
   - Placeholder shows max convertible amount in user's currency
   - Optional: leave empty to convert all wallet balance

3. **Live conversion preview:**
   - Shows "You'll receive: X credits" as user types
   - Calculates based on currency and current credit rate

4. **Action buttons:**
   - Cancel: closes modal and resets input
   - Confirm: validates, converts input currency to USD, sends to API

**Currency Conversion Logic:**
```typescript
// User input is in their preferred currency (INR or USD)
const inputAmount = parseFloat(convertAmount)
const amountUsd = currency === 'INR' 
  ? inputAmount / INR_RATE  // Convert ₹ to $
  : inputAmount              // Already in $

// Send USD amount to API
await fetch('/api/credits/convert', { 
  method: 'POST',
  body: JSON.stringify({ amount_usd: amountUsd })
})
```

### 3. Trigger Button Update
**Before:**
- Button directly called `handleConvert()` to convert ALL wallet
- Showed "Converting..." spinner

**After:**
- Button opens modal: `onClick={() => setShowConvertModal(true)}`
- No spinner on button (spinner moved to modal's Confirm button)
- User controls amount before conversion

## User Flow

1. **Old Flow:**
   - User clicks "Convert to Credits" button
   - ALL wallet balance instantly converts (no confirmation, no choice)

2. **New Flow:**
   - User clicks "Convert to Credits" button
   - Modal opens showing:
     - Current wallet balance in their currency (₹ or $)
     - Conversion rate in their currency
     - Amount input field
   - User enters amount (e.g., ₹100) OR leaves empty for all
   - User sees live preview: "You'll receive: 35 credits"
   - User clicks Confirm
   - API converts specified amount (or all if empty)
   - Success message shows amount + credits received

## Currency Support

### Indian Users (currency === 'INR')
- Input field shows ₹ symbol
- Placeholder: "Max: ₹182.00" (example)
- Conversion rate: "₹3.19 per credit"
- Input step: 1 (whole rupees)
- Backend: converts ₹ → $ before API call

### US Users (currency === 'USD')
- Input field shows $ symbol
- Placeholder: "Max: $2.00" (example)
- Conversion rate: "$0.035 per credit"
- Input step: 0.01 (cents)
- Backend: sends $ directly to API

## Validation

1. **Empty input:** Converts ALL wallet balance (original behavior preserved)
2. **Invalid amount:** Shows error "Please enter a valid amount"
3. **Exceeds wallet:** Shows error "Amount exceeds wallet balance (₹X or $X)"
4. **Below 0:** Number input's `min="0.01"` prevents this

## Success Message

Displays converted amount in user's currency:
```
✅ Converted ₹100.00 → +31 credits! You now have 120 total credits.
```
or
```
✅ Converted $2.00 → +57 credits! You now have 77 total credits.
```

## Technical Details

### API Contract
**POST /api/credits/convert**

**Request:**
```json
{
  "amount_usd": 1.5  // Optional; null or omit to convert all
}
```

**Response (Success):**
```json
{
  "success": true,
  "amountConverted": 1.5,
  "creditsAdded": 42,
  "newWallet": 0.5,
  "newCredits": 120,
  "message": "Converted $1.50 → 42 credits"
}
```

**Response (Error):**
```json
{
  "error": "Amount exceeds wallet balance ($2.00)",
  "wallet": 2.0
}
```

### Migration Compatibility

This feature uses the updated `convert_wallet_to_credits` RPC from migration 123:
```sql
CREATE OR REPLACE FUNCTION convert_wallet_to_credits(
  p_clerk_user_id TEXT,
  p_amount_usd NUMERIC DEFAULT NULL  -- NEW: supports partial conversions
)
```

**Not yet applied in Supabase** - feature will work with amount input once migration 123 is deployed.

## Deployment Status

- ✅ Code committed: `950c010`
- ✅ Pushed to master
- ✅ Auto-deployed to Vercel
- ⏳ Migration 123 pending (needed for partial conversions)

## Testing Checklist

- [ ] Open pricing page with wallet balance > 0
- [ ] Click "Convert to Credits" button
- [ ] Modal opens with currency display
- [ ] Enter partial amount (e.g., ₹50 if in India)
- [ ] See live preview update
- [ ] Click Confirm
- [ ] Verify success message in correct currency
- [ ] Check wallet + credits updated correctly
- [ ] Test empty input (convert all)
- [ ] Test exceeding wallet balance (should error)

## Related Files

- `/app/api/credits/convert/route.ts` - API endpoint
- `/app/pricing/page.tsx` - Modal UI + handler
- `/db/migrations/123_convert_all_wallet_to_credits.sql` - RPC definition (pending)

## Next Steps

1. **Apply migration 123** in Supabase to enable partial conversions
2. **Test with real wallet balance** in different currencies
3. **Consider adding:** "Convert All" shortcut button in modal for UX

---

**Commit:** `950c010`  
**Branch:** master  
**Status:** Live on Vercel
