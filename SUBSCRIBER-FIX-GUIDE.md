# Subscriber Credits Not Delivered - Fix Guide

## Issue
Customer `cust_RzpFbQMBALcaE3` subscribed to Creator plan (`sub_S2ECfcFfPrjEm8`) but didn't receive:
1. 100 credits
2. Creator badge in UI
3. Any indication of active subscription

## Root Causes
1. **Razorpay webhook not configured yet** - payments aren't triggering the webhook
2. **Customer ID not linked to user** - even if webhook fired, it can't find the user

## Solutions

### Option 1: Manual Activation (Immediate Fix)

#### Step 1: Find the User
1. Go to Razorpay Dashboard → Customers → Find `cust_RzpFbQMBALcaE3`
2. Note their email address
3. Go to Clerk Dashboard → Users → Search by that email
4. Copy their Clerk User ID (starts with `user_`)

#### Step 2: Run SQL Script
1. Open Supabase Dashboard → SQL Editor
2. Open `activate-subscriber.sql` from project root
3. Replace `USER_ID_HERE` with the Clerk User ID from Step 1
4. Run the script

This will:
- Add 100 credits
- Set `subscription_status = 'active'`
- Set `subscription_plan = 'creator'`
- Link Razorpay customer ID
- Set subscription dates

### Option 2: Use API Endpoint

```bash
POST https://444radio.co.in/api/admin/activate-subscription
Content-Type: application/json

{
  "clerk_user_id": "user_XXXXX",  # From Clerk dashboard
  "razorpay_customer_id": "cust_RzpFbQMBALcaE3",
  "subscription_id": "sub_S2ECfcFfPrjEm8",
  "subscription_plan": "creator",
  "credits_to_add": 100
}
```

### Option 3: Configure Webhook (Prevents Future Issues)

#### Step 1: Setup Razorpay Webhook
1. Go to Razorpay Dashboard → Settings → Webhooks
2. Click "+ Add Webhook"
3. **Webhook URL**: `https://444radio.co.in/api/razorpay/webhook`
4. **Active Events**: Select all:
   - `subscription.activated`
   - `subscription.charged`
   - `subscription.cancelled`
   - `subscription.expired`
   - `subscription.halted`
   - `subscription.paused`
   - `subscription.resumed`
5. **Secret**: Click "Generate Secret" and copy it
6. Click "Create Webhook"

#### Step 2: Add Secret to Vercel
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Add new variable:
   - **Name**: `RAZORPAY_WEBHOOK_SECRET`
   - **Value**: [paste the secret from Razorpay]
   - **Environment**: Production, Preview, Development
3. **Redeploy** the app for env var to take effect

#### Step 3: Test Webhook
1. In Razorpay Dashboard → Webhooks → Click on the webhook
2. Click "Send Test Webhook"
3. Select `subscription.charged` event
4. Check Vercel logs for successful processing

## UI Changes Deployed

### CreditIndicator Component
Now shows:
- **Regular users**: Cyan badge with credits count
- **Subscribed users**: 
  - Purple/cyan gradient background
  - Gold crown icon
  - "CREATOR" label below credits
  - Purple shadow effect

### API Response
`GET /api/credits` now returns:
```json
{
  "credits": 120,
  "totalGenerated": 5,
  "subscription_status": "active"  // NEW
}
```

## Verification Steps

After fixing the subscriber:
1. User logs in to 444radio.co.in
2. Top-right credit indicator shows:
   - Gold crown icon
   - Purple gradient background
   - Credits count
   - "CREATOR" label
3. User can generate unlimited content (check implementation)
4. Subscription visible in Razorpay as "Active"

## Database Schema

Migration `009_add_subscription_fields.sql` added:
```sql
ALTER TABLE users ADD COLUMN razorpay_customer_id TEXT;
ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'none';
ALTER TABLE users ADD COLUMN subscription_plan TEXT;
ALTER TABLE users ADD COLUMN subscription_id TEXT;
ALTER TABLE users ADD COLUMN subscription_start TIMESTAMP;
ALTER TABLE users ADD COLUMN subscription_end TIMESTAMP;
```

**Make sure this migration ran on production!**

## Files Modified

1. `app/components/CreditIndicator.tsx` - Added subscription badge
2. `app/api/credits/route.ts` - Returns subscription_status
3. `app/api/razorpay/webhook/route.ts` - Handles payment events
4. `app/api/admin/activate-subscription/route.ts` - Manual activation endpoint
5. `db/migrations/009_add_subscription_fields.sql` - Schema changes

## Next Steps

1. **Immediate**: Fix this subscriber using Option 1 or 2
2. **Today**: Configure webhook using Option 3
3. **Monitor**: Check Vercel logs for webhook events
4. **Test**: Create a test subscription to verify full flow
