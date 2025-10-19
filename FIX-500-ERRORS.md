# 🚨 URGENT: Fix 500 Errors - Production Checklist

## Your Current Errors:
```
❌ /api/credits:1 Failed to load resource: 500
❌ /api/generate:1 Failed to load resource: 500
⚠️  Clerk: Development keys warning
```

---

## 🔥 QUICK FIX (15 minutes)

### 1️⃣ GET YOUR CLERK PRODUCTION KEYS

**Go to Clerk Dashboard:** https://dashboard.clerk.com

1. Click on your app: **"inviting-flea-30"**
2. Look at the top right - is it "Development" or "Production"?

#### If it says "Development":
- Click **"Enable Production"** button (or upgrade plan)
- Follow prompts to upgrade

#### Get Your Keys:
1. In left sidebar → **"API Keys"**
2. Make sure you're viewing **LIVE** keys (toggle at top)
3. Copy these:
   - **Publishable Key**: starts with `pk_live_...`
   - **Secret Key**: starts with `sk_live_...` (click "Show")

---

### 2️⃣ CREATE PRODUCTION WEBHOOK

1. Still in Clerk Dashboard → **"Webhooks"**
2. Click **"+ Add Endpoint"**
3. **URL**: `https://444radio.co.in/api/webhook`
4. **Events to subscribe**:
   - ✅ user.created
   - ✅ user.updated  
   - ✅ user.deleted
5. Click **"Create"**
6. **COPY THE SIGNING SECRET**: `whsec_...`

---

### 3️⃣ VERIFY REPLICATE API TOKEN

**Go to:** https://replicate.com/account/api-tokens

1. Sign in
2. Copy your API token (starts with `r8_...`)
3. **IMPORTANT**: Make sure billing is enabled!
   - Go to: https://replicate.com/account/billing
   - Add payment method if needed (free tier has limits)

---

### 4️⃣ UPDATE VERCEL ENVIRONMENT VARIABLES

**Go to:** https://vercel.com/dashboard

1. Find **444Radio** project → Click it
2. **Settings** → **Environment Variables**

#### Update/Add These Variables:

**For ALL environments** (Production, Preview, Development):

1. **NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY**
   - Delete old one if exists
   - Add new: `pk_live_...` (from step 1)

2. **CLERK_SECRET_KEY**
   - Delete old one if exists
   - Add new: `sk_live_...` (from step 1)

3. **CLERK_WEBHOOK_SECRET**
   - Delete old one if exists
   - Add new: `whsec_...` (from step 2)

4. **REPLICATE_API_TOKEN**
   - Check if it exists
   - Add/Update: `r8_...` (from step 3)

5. **SUPABASE_SERVICE_ROLE_KEY** ⚠️ CRITICAL
   - Get from: https://supabase.com/dashboard/project/yirjulakkgignzbrqnth/settings/api
   - Look for **"service_role"** key (NOT anon key)
   - Add: `eyJ...` (long string)

6. **NEXT_PUBLIC_SUPABASE_URL**
   - Should be: `https://yirjulakkgignzbrqnth.supabase.co`

7. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
   - Get from same Supabase API settings page
   - Look for **"anon public"** key
   - Add: `eyJ...`

---

### 5️⃣ REDEPLOY (CRITICAL!)

**Environment variables only work AFTER redeployment!**

#### Option A - Vercel Dashboard:
1. Go to **"Deployments"** tab
2. Click latest deployment
3. Click **"..."** menu → **"Redeploy"**
4. ⚠️ **UNCHECK** "Use existing build cache"
5. Click **"Redeploy"**

#### Option B - Git Push:
```bash
git commit --allow-empty -m "trigger redeploy"
git push origin master
```

Wait 2-3 minutes for deployment to complete.

---

### 6️⃣ TEST YOUR SITE

1. Visit: **https://444radio.co.in**
2. Open browser console (F12)
3. **Check for**:
   - ✅ NO "development keys" warning
   - ✅ NO 500 errors
   - ✅ Credits display shows 20

4. **Test signup**:
   - Create new account
   - Should get 20 credits instantly
   - Try generating music

---

## 🔍 TROUBLESHOOTING

### Still Getting 500 Errors?

#### Check Vercel Function Logs:
1. Vercel Dashboard → Your Project
2. Click **"Logs"** tab
3. Look for red error messages
4. Common errors:
   - `REPLICATE_API_TOKEN is not defined` → Add it to Vercel
   - `SUPABASE_SERVICE_ROLE_KEY is not defined` → Add it to Vercel
   - `Webhook verification failed` → Check CLERK_WEBHOOK_SECRET

#### Verify All Keys Are Set:
Run this in Vercel → **Settings** → **Environment Variables**:
- [ ] NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (pk_live_...)
- [ ] CLERK_SECRET_KEY (sk_live_...)
- [ ] CLERK_WEBHOOK_SECRET (whsec_...)
- [ ] REPLICATE_API_TOKEN (r8_...)
- [ ] SUPABASE_SERVICE_ROLE_KEY (eyJ...)
- [ ] NEXT_PUBLIC_SUPABASE_URL
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY

#### Did You Redeploy?
After adding/changing environment variables, you MUST redeploy!

---

## 📋 QUICK CHECKLIST

- [ ] Got Clerk production keys (pk_live_... and sk_live_...)
- [ ] Created webhook in Clerk with signing secret
- [ ] Got Replicate API token (r8_...)
- [ ] Replicate billing enabled
- [ ] Got Supabase service role key (not anon key!)
- [ ] Updated ALL 7 environment variables in Vercel
- [ ] Redeployed the site
- [ ] Tested and no errors!

---

## 🆘 STILL STUCK?

Tell me which step you're on and what error you're seeing!

Most likely issues:
1. **Forgot to redeploy** after updating variables
2. **Using wrong Supabase key** (anon instead of service_role)
3. **Replicate billing not enabled**
4. **Clerk still on development mode**
