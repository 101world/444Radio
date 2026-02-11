# Credit Allocation Update - Verification Checklist

## ✅ Deployed: February 6, 2026

## New Credit Allocations (Price ÷ $0.03)

| Plan | Price | Credits | Songs/Month | Change |
|------|-------|---------|-------------|--------|
| **Creator** | $5 | **167** | 83 | ↑ +67 (was 100) |
| **Pro** | $16 | **535** | 267 | ↓ -65 (was 600) |
| **Studio** | $37 | **1235** | 617 | ↓ -265 (was 1500) |

## 🔒 NEVER REDUCE POLICY

**Existing subscribers:**
- ✅ Creator: Get +67 bonus credits (moving up to new rate)
- ✅ Pro/Studio: Keep their higher allocations (grandfathered at 600/1500)
- ✅ Migration only ADDS credits, never subtracts

**New subscribers (from now on):**
- Get the new allocation based on their plan

## Credit Costs (Unchanged)

| Feature | Cost | Real API Cost | Markup |
|---------|------|---------------|--------|
| Music/Instrumental | 2 credits ($0.06) | $0.03 | 2x |
| Stem Splitter | 5 credits ($0.15) | $0.04 | 3.75x |
| Video-to-SFX | 2 credits ($0.06) | $0.0059 | 10x |
| Text-to-SFX | 2 credits ($0.06) | $0.012 | 5x |
| Cover Art | 1 credit ($0.03) | $0.011 | 2.7x |
| Atom LLM | FREE | $0.40/M tokens | Burn cost |

## Verification Steps

### 1. Check Existing Subscribers
Run in Supabase SQL editor:
```sql
-- Check Creator subscribers got bonus credits
SELECT 
  email,
  credits,
  subscription_plan,
  subscription_status,
  updated_at
FROM users
WHERE subscription_status = 'active'
  AND (subscription_plan ILIKE '%creator%' OR subscription_plan = 'plan_S2DGVK6J270rtt')
ORDER BY updated_at DESC;
```

### 2. Test New Subscription Flow

#### Test Case 1: Creator Plan ($5 monthly)
1. ✅ Go to /pricing
2. ✅ Select Creator plan (monthly)
3. ✅ Complete Razorpay checkout
4. ✅ Verify webhook receives credits: **167** (from order notes)
5. ✅ Check user gets exactly 167 credits

#### Test Case 2: Pro Plan ($16 monthly)
1. ✅ Go to /pricing
2. ✅ Select Pro plan (monthly)
3. ✅ Complete Razorpay checkout
4. ✅ Verify webhook receives credits: **535** (from order notes)
5. ✅ Check user gets exactly 535 credits

#### Test Case 3: Studio Plan ($37 monthly)
1. ✅ Go to /pricing
2. ✅ Select Studio plan (monthly)
3. ✅ Complete Razorpay checkout
4. ✅ Verify webhook receives credits: **1235** (from order notes)
5. ✅ Check user gets exactly 1235 credits

### 3. Verify Webhook Flow

Check Razorpay webhook logs for payment.captured event:
```javascript
// Should log:
"[Razorpay] Credits from payment notes: 167" // Creator
"[Razorpay] Credits from payment notes: 535" // Pro
"[Razorpay] Credits from payment notes: 1235" // Studio
```

### 4. Check Pricing Page Display

**Creator Card:**
- Shows: "167 credits per month"
- Shows: "~83 songs or 167 cover art"
- Shows: "~83 Text to SFX (10s)"
- Shows: "~83 Video to SFX (10s)"

**Pro Card:**
- Shows: "535 credits per month"
- Shows: "~267 songs or 535 cover art"
- Shows: "~267 Text to SFX (10s)"
- Shows: "~267 Video to SFX (10s)"

**Studio Card:**
- Shows: "1,235 credits per month"
- Shows: "~617 songs or 1,235 cover art"
- Shows: "~617 Text to SFX (10s)"
- Shows: "~617 Video to SFX (10s)"

## Files Modified

### API Routes
- ✅ `app/api/subscriptions/checkout/route.ts` - Updated PLANS config, passes credits via order.notes
- ✅ `app/api/webhooks/razorpay/route.ts` - Reads credits from order.notes or plan mapping
- ✅ `app/api/razorpay-webhook/route.ts` - Same as above (duplicate webhook)
- ✅ `app/api/webhooks/paypal/route.ts` - Updated Creator: 167 credits

### UI Pages
- ✅ `app/pricing/page.tsx` - Updated all credit displays
- ✅ `app/subscribe/page.tsx` - Updated Creator: 167 credits

### Database
- ✅ `db/migrations/1003_UPDATE_credit_allocations_feb_2026.sql` - Bonus credits for existing Creator subscribers

## Webhook Credit Flow

```
User subscribes → checkout/route.ts creates order
                 ↓
              order.notes = {
                clerk_user_id,
                plan_type,
                credits: "167" / "535" / "1235"
              }
                 ↓
         Razorpay payment.captured webhook
                 ↓
       webhooks/razorpay/route.ts reads notes.credits
                 ↓
         Updates user: credits += notes.credits
                 ↓
              ✅ User receives correct amount
```

## Safety Checks

### ❌ What CAN'T Happen
- ❌ Existing subscribers losing credits
- ❌ Wrong credit amount for new subscribers
- ❌ Webhook failing to deliver credits
- ❌ Credits being subtracted instead of added

### ✅ What DOES Happen
- ✅ Checkout passes exact credit amount via order.notes
- ✅ Webhook reads from notes.credits (most reliable)
- ✅ Fallback to plan mapping if notes missing (backwards compat)
- ✅ Migration only adds credits (+67 for Creator)
- ✅ All existing subscribers keep their credits

## Rollback Plan (If Needed)

If issues arise, revert with:
```bash
git revert f77e9d3
git push
```

And manually adjust affected users in Supabase:
```sql
UPDATE users 
SET credits = credits - 67
WHERE subscription_plan ILIKE '%creator%'
  AND updated_at > '2026-02-06';
```

## Production URLs to Monitor

- **Pricing**: https://444radio.co.in/pricing
- **Subscribe**: https://444radio.co.in/subscribe  
- **User Credits**: https://444radio.co.in/api/credits
- **Webhook**: https://444radio.co.in/api/webhooks/razorpay

## Success Metrics

After 24 hours, verify:
- [ ] No complaints from existing subscribers about lost credits
- [ ] All new subscribers receive correct credit amount
- [ ] Webhook logs show correct credit values from notes
- [ ] Revenue matches credit cost expectations

---

**Deployed:** February 6, 2026  
**Status:** ✅ Live in Production  
**Commit:** `f77e9d3`
