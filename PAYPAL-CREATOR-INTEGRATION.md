# PayPal Creator Plan Integration - Setup Guide

## ✅ **What's Been Implemented**

1. ✅ **PayPal Webhook Handler** (`app/api/webhooks/paypal/route.ts`)
   - Processes subscription events (created, activated, cancelled, etc.)
   - Verifies PayPal webhook signatures
   - Automatically credits users when subscription activates
   - Updates subscription status in database

2. ✅ **PayPal Button Integration** (`app/pricing/page.tsx`)
   - Modal with PayPal Subscribe button for Creator plan
   - Triggered when user clicks "Get Started" on USD Creator plan
   - Handles subscription approval and redirects to creation page

3. ✅ **Success Handler** (`app/api/subscriptions/paypal-success/route.ts`)
   - Processes client-side subscription approval
   - Stores subscription ID in database

4. ✅ **Middleware Update** (`middleware.ts`)
   - Added `/api/webhooks/paypal` to public routes
   - Allows PayPal to send webhook events without auth

---

## 🔧 **Required: Environment Variables**

Add these to your `.env.local` file (and Vercel environment variables):

```env
# PayPal Configuration
NEXT_PUBLIC_PAYPAL_CLIENT_ID=AUjHfkrdxT3jsI45Q8QH6RBmpqY4NOppurI40wODhV7WY3sgmxrOXlHmDH0MSz-1eRraYxGVlHolbRLZ
PAYPAL_CLIENT_SECRET=YOUR_SECRET_HERE
PAYPAL_WEBHOOK_ID=YOUR_WEBHOOK_ID_HERE
NEXT_PUBLIC_PAYPAL_CREATOR_PLAN_ID=P-0CB99005AU3792201NGA5UHY
NEXT_PUBLIC_PAYPAL_MODE=live
```

### 📝 **How to Get Missing Values:**

#### 1. **PAYPAL_CLIENT_SECRET**
1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Click **"My Apps & Credentials"**
3. Select your app (or create one)
4. Under **"LIVE"** tab, find **"Secret"**
5. Click **"Show"** and copy the value

#### 2. **PAYPAL_WEBHOOK_ID**
1. Go to [PayPal Webhooks](https://developer.paypal.com/dashboard/webhooks)
2. Click **"Add Webhook"**
3. **Webhook URL**: `https://444radio.co.in/api/webhooks/paypal`
4. **Event types** - Select these:
   - `BILLING.SUBSCRIPTION.CREATED`
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
   - `BILLING.SUBSCRIPTION.SUSPENDED`
   - `BILLING.SUBSCRIPTION.EXPIRED`
   - `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
5. Click **"Save"**
6. Copy the **Webhook ID** from the webhook details page

---

## 🗄️ **Required: Database Schema Update**

Your Supabase `users` table needs these columns (likely already exist):

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT; -- 'active', 'cancelled', 'suspended', 'pending'
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan TEXT; -- 'creator', 'pro', 'studio'
```

---

## 🚀 **Deployment Steps**

### 1. **Add Environment Variables to Vercel**
```bash
# In Vercel Dashboard → Project → Settings → Environment Variables
# Add all 5 PayPal variables from above
```

### 2. **Deploy to Vercel**
```powershell
git add .
git commit -m "Add PayPal subscription integration for Creator plan"
git push origin master
```

### 3. **Verify Deployment**
- Visit: `https://444radio.co.in/pricing`
- Select **USD** currency
- Click **"Get Started"** on Creator plan
- PayPal modal should open with Subscribe button

### 4. **Test Webhook**
1. Go to [PayPal Webhooks Dashboard](https://developer.paypal.com/dashboard/webhooks)
2. Click your webhook
3. Click **"Send test notification"**
4. Select event type: `BILLING.SUBSCRIPTION.ACTIVATED`
5. Check your Vercel logs to confirm webhook received

---

## 🧪 **Testing Flow**

### **End-to-End Test:**
1. Visit `/pricing`
2. Switch to **USD** currency
3. Click **"Get Started"** on **Creator Plan**
4. PayPal modal opens
5. Click blue **"Subscribe"** button
6. Login to PayPal (use sandbox account if testing)
7. Approve subscription
8. Wait for success message
9. Redirected to `/create`
10. Check database: `users.credits` should have +100, `subscription_status` = 'active'

### **Webhook Test:**
```bash
# Check Vercel logs after subscription approval
# Should see:
# ✅ Webhook signature verified
# 🎉 Subscription activated - granting credits
# ✅ Granted 100 credits to user user_xxxxx
```

---

## 📊 **Expected User Flow**

1. **User clicks "Get Started"** → PayPal modal opens
2. **User subscribes via PayPal** → `paypal_subscription_id` saved to DB
3. **PayPal sends webhook** → `BILLING.SUBSCRIPTION.ACTIVATED`
4. **Webhook handler** → Credits +100, `subscription_status` = 'active'
5. **User can create** → Full access to generation features

---

## 🔍 **Monitoring & Debugging**

### **Check Webhook Logs (PayPal Dashboard)**
1. Go to [Webhooks](https://developer.paypal.com/dashboard/webhooks)
2. Click your webhook
3. View **"Recent Deliveries"** tab
4. See success/failure status and payload

### **Check Vercel Logs**
```bash
# See real-time logs
vercel logs --follow

# Filter for PayPal webhooks
vercel logs --follow | grep "PayPal webhook"
```

### **Check Database**
```sql
-- See all PayPal subscriptions
SELECT clerk_user_id, paypal_subscription_id, subscription_status, subscription_plan, credits
FROM users
WHERE paypal_subscription_id IS NOT NULL;
```

---

## ⚠️  **Important Notes**

1. **Webhook Signature Verification**: 
   - CRITICAL for production
   - Prevents fraudulent webhook calls
   - Requires `PAYPAL_WEBHOOK_ID` to be set

2. **Credits Timing**:
   - Credits added by webhook (NOT on client approval)
   - Usually takes 10-60 seconds after subscription
   - User sees "Credits will be added within 1-2 minutes" message

3. **Subscription Cancellation**:
   - User cancels in PayPal dashboard
   - Webhook `BILLING.SUBSCRIPTION.CANCELLED` fires
   - `subscription_status` updated to 'cancelled'
   - User keeps credits until billing period ends

4. **Plan ID Validation**:
   - Current implementation only handles Creator plan
   - To add Pro/Studio, create more plans in PayPal and update code

---

## 🛠️  **Future Enhancements**

- [ ] Add Pro/Studio PayPal plans
- [ ] Support annual billing via PayPal
- [ ] Add PayPal to other plans (not just Creator)
- [ ] Show subscription management page (cancel, upgrade, etc.)
- [ ] Email notifications on subscription events
- [ ] Retry logic for failed webhook processing

---

## 📞 **Support**

If issues occur:
1. Check Vercel logs: `vercel logs --follow`
2. Check PayPal webhook delivery status
3. Verify all environment variables are set
4. Ensure webhook URL is correct: `https://444radio.co.in/api/webhooks/paypal`
5. Test signature verification is working

---

## ✨ **What's Next?**

Once you provide:
- ✅ `PAYPAL_CLIENT_SECRET`
- ✅ `PAYPAL_CLIENT_SECRET`
- ✅ `PAYPAL_WEBHOOK_ID`

You can:
1. Add them to `.env.local` (local testing)
2. Add them to Vercel (production)
3. Deploy and test!

The PayPal Creator subscription is now fully integrated and ready to go! 🚀
