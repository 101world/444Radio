# Quick Fix for Subscriber cust_RzpFbQMBALcaE3

## Step-by-Step (5 minutes)

### 1. Get Customer Email from Razorpay
1. Open **Razorpay Dashboard**: https://dashboard.razorpay.com/
2. Go to **Customers** (left sidebar)
3. Search for: `cust_RzpFbQMBALcaE3`
4. **Copy the email address** shown on the customer page

### 2. Open Supabase SQL Editor
1. Open **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your **444Radio project**
3. Go to **SQL Editor** (left sidebar)
4. Click **"+ New query"**

### 3. Find the User First
Paste this query (replace the email):
```sql
SELECT 
  clerk_user_id,
  email,
  credits as current_credits,
  subscription_status,
  razorpay_customer_id
FROM users 
WHERE email = 'PASTE_EMAIL_HERE';
```

Hit **Run** - you should see 1 row with the user's current data.

### 4. Activate Subscription
Paste this query (replace the email with same email from step 3):
```sql
UPDATE users
SET 
  credits = credits + 100,
  subscription_status = 'active',
  subscription_plan = 'plan_S2DGVK6J270rtt',
  subscription_id = 'sub_S2ECfcFfPrjEm8',
  razorpay_customer_id = 'cust_RzpFbQMBALcaE3',
  subscription_start = EXTRACT(EPOCH FROM NOW())::BIGINT,
  subscription_end = EXTRACT(EPOCH FROM (NOW() + INTERVAL '30 days'))::BIGINT,
  updated_at = NOW()
WHERE email = 'PASTE_EMAIL_HERE';
```

Hit **Run** - should say "Success. 1 rows affected."

### 5. Verify It Worked
Run this query (same email):
```sql
SELECT 
  email,
  credits,
  subscription_status,
  subscription_plan,
  razorpay_customer_id
FROM users 
WHERE email = 'PASTE_EMAIL_HERE';
```

Should show:
- ✅ `credits`: increased by 100
- ✅ `subscription_status`: 'active'
- ✅ `subscription_plan`: 'plan_S2DGVK6J270rtt'
- ✅ `razorpay_customer_id`: 'cust_RzpFbQMBALcaE3'

### 6. Tell User to Check
User should:
1. Go to https://444radio.co.in
2. Refresh the page (Ctrl+F5)
3. Look at top-right corner

Should see:
- ✅ **Gold crown icon** 👑
- ✅ **Purple/cyan gradient background**
- ✅ **"CREATOR" label**
- ✅ **100 credits added** to their account

---

## Alternative: If You Don't Know the Email

If Razorpay customer page doesn't show email, you can find it via subscription:

1. Razorpay Dashboard → **Subscriptions**
2. Find subscription ID: `sub_S2ECfcFfPrjEm8`
3. Click on it → Shows **Customer Name** and **Customer ID**
4. Click Customer ID → Shows **Email**

---

## Troubleshooting

**"0 rows affected"**: 
- Email doesn't match any user in database
- Check spelling carefully
- Try searching by subscription ID in Razorpay first

**"Column does not exist"**:
- Run the migration SQL first: `RUN-THIS-FIRST-IN-SUPABASE.sql`

**User still doesn't see badge**:
- Wait 30 seconds (credit indicator refreshes every 30s)
- Or hard refresh: Ctrl+Shift+R
- Check browser console for errors

---

## Files to Use
- `fix-subscriber-cust_RzpFbQMBALcaE3.sql` - Complete SQL script with all steps
- This guide - Step-by-step instructions
