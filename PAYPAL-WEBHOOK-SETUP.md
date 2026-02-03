# ⚠️ URGENT: Create PayPal Webhook

## 📋 You Have Provided:
✅ Client ID: `AfI_Nw0tWj84Bv6-ec0Zttw8ffahp22cbFLKSVpBTuPn896wFF_BXq33h5wofIucj1cdk6L-zXgAWNK4`
✅ Secret: `EDmHX3FRzKNq2XAydyCGKlRpIla30djPMltsoRtliEPWcOJGwHAqdxVDOEeJBeBSfbmo0RruqgoLD8-7`
✅ Plan ID: `P-0CB99005AU3792201NGA5UHY`

## ❌ Still Missing:
**PAYPAL_WEBHOOK_ID** - Follow these steps NOW:

---

## 🔧 Step-by-Step: Create PayPal Webhook

### 1. Go to PayPal Webhooks Page
Visit: https://developer.paypal.com/dashboard/webhooks

### 2. Click "Add Webhook" Button
(Top right corner)

### 3. Fill in Webhook Details

**Webhook URL:**
```
https://444radio.co.in/api/webhooks/paypal
```

**Event types to subscribe to** (click "Select all events" or manually select these):
- ✅ `BILLING.SUBSCRIPTION.CREATED`
- ✅ `BILLING.SUBSCRIPTION.ACTIVATED`
- ✅ `BILLING.SUBSCRIPTION.CANCELLED`
- ✅ `BILLING.SUBSCRIPTION.SUSPENDED`
- ✅ `BILLING.SUBSCRIPTION.EXPIRED`
- ✅ `BILLING.SUBSCRIPTION.PAYMENT.FAILED`

### 4. Save Webhook
Click **"Save"** button

### 5. Copy Webhook ID
- After saving, you'll see the webhook details page
- Copy the **Webhook ID** (looks like: `4JH75643GG123456E`)
- Send it to me or add to environment variables directly

---

## 🔐 Add to Environment Variables

### Option A: Add to `.env.local` (Local Testing)
Create/update `c:\444Radio\.env.local`:

```env
# PayPal Live Credentials
NEXT_PUBLIC_PAYPAL_CLIENT_ID=AfI_Nw0tWj84Bv6-ec0Zttw8ffahp22cbFLKSVpBTuPn896wFF_BXq33h5wofIucj1cdk6L-zXgAWNK4
PAYPAL_CLIENT_SECRET=EDmHX3FRzKNq2XAydyCGKlRpIla30djPMltsoRtliEPWcOJGwHAqdxVDOEeJBeBSfbmo0RruqgoLD8-7
PAYPAL_WEBHOOK_ID=YOUR_WEBHOOK_ID_HERE
NEXT_PUBLIC_PAYPAL_CREATOR_PLAN_ID=P-0CB99005AU3792201NGA5UHY
NEXT_PUBLIC_PAYPAL_MODE=live
```

### Option B: Add to Vercel (Production)
1. Go to: https://vercel.com/your-project/settings/environment-variables
2. Add these 5 variables (one by one):
   - `NEXT_PUBLIC_PAYPAL_CLIENT_ID`
   - `PAYPAL_CLIENT_SECRET`
   - `PAYPAL_WEBHOOK_ID` (add after creating webhook)
   - `NEXT_PUBLIC_PAYPAL_CREATOR_PLAN_ID`
   - `NEXT_PUBLIC_PAYPAL_MODE`

---

## 🚀 Quick Deploy Commands

### After adding webhook ID to `.env.local`:

```powershell
# 1. Test locally first
npm run dev
# Visit http://localhost:3000/pricing
# Select USD → Click "Get Started" on Creator plan

# 2. If working, deploy to production
git add .
git commit -m "Add PayPal Creator subscription with live credentials"
git push origin master

# 3. Add environment variables to Vercel Dashboard
# Then redeploy or wait for auto-deploy
```

---

## ✅ Verification Checklist

After deployment:
- [ ] Visit https://444radio.co.in/pricing
- [ ] Switch to USD currency
- [ ] Click "Get Started" on Creator Plan
- [ ] PayPal modal opens
- [ ] Blue "Subscribe" button appears
- [ ] Click subscribe → PayPal checkout opens
- [ ] Complete subscription (use test amount if nervous)
- [ ] Check PayPal webhook dashboard for delivery confirmation
- [ ] Check Vercel logs for webhook processing
- [ ] Verify 100 credits added to user account in Supabase

---

## 🎯 What Happens Next

1. **User Flow:**
   - Clicks "Get Started" → PayPal modal
   - Clicks "Subscribe" → PayPal login
   - Approves subscription → Success message
   - Redirected to `/create`

2. **Backend Flow:**
   - Client saves `paypal_subscription_id` to DB
   - PayPal sends webhook to `https://444radio.co.in/api/webhooks/paypal`
   - Webhook verifies signature using `PAYPAL_WEBHOOK_ID`
   - Webhook adds 100 credits to user
   - Sets `subscription_status = 'active'`
   - User can now generate content!

---

## 🆘 If Something Goes Wrong

### Webhook not received:
1. Check PayPal Dashboard → Webhooks → Recent Deliveries
2. Verify URL is exactly: `https://444radio.co.in/api/webhooks/paypal`
3. Check if webhook events are selected
4. Check Vercel logs for errors

### Credits not added:
1. Check webhook signature verification (needs `PAYPAL_WEBHOOK_ID`)
2. Check Supabase users table for subscription fields
3. Check Vercel logs for database errors

### PayPal button not showing:
1. Verify Client ID in environment variables
2. Check browser console for JavaScript errors
3. Verify PayPal SDK loaded (check Network tab)

---

## 📞 Send Me the Webhook ID!

Once you create the webhook, just paste the Webhook ID here and I'll help you deploy! 

**You're 1 step away from going live! 🚀**
