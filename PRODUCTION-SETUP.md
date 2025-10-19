# 🚀 444RADIO - Production Deployment Guide (Vercel + Clerk + Supabase)

## ✅ YOUR CURRENT SETUP

- **Live Website**: https://444radio.co.in (on Vercel)
- **GitHub Repo**: https://github.com/101world/444Radio
- **Clerk App**: inviting-flea-30.clerk.accounts.dev
- **Supabase**: yirjulakkgignzbrqnth.supabase.co

---

## 🎯 PRODUCTION SETUP (3 STEPS - 10 MINUTES)

### **STEP 1: Configure Clerk for Production** ⚙️

1. **Go to Clerk Dashboard**: https://dashboard.clerk.com
2. **Select your app**: "inviting-flea-30"
3. **Configure Domains**:
   - Go to: **Settings** → **Domains**
   - Add domain: `444radio.co.in`
   - Set as primary domain
   
4. **Set Up Webhook** (IMPORTANT):
   - Go to: **Webhooks** → **Add Endpoint**
   - **Endpoint URL**: `https://444radio.co.in/api/webhook`
   - **Subscribe to events**:
     - ✅ `user.created`
     - ✅ `user.updated`
     - ✅ `user.deleted`
   - Click **Create**
   - **Copy the Signing Secret** (starts with `whsec_...`)

5. **Update Redirect URLs**:
   - Go to: **Paths** → **Component paths**
   - Set:
     - Sign-in URL: `/sign-in`
     - Sign-up URL: `/sign-up`
     - After sign-in: `/`
     - After sign-up: `/`

---

### **STEP 2: Add Environment Variables to Vercel** 🔐

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Select your project**: `444Radio`
3. **Go to**: **Settings** → **Environment Variables**
4. **Add these variables** (one by one):

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_aW52aXRpbmctZmxlYS0zMC5jbGVyay5hY2NvdW50cy5kZXYk
CLERK_SECRET_KEY=sk_test_9qzd8G9IuubG02KCzcpoQ1eKyYkFdiTaokwWlwiiTP
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
CLERK_WEBHOOK_SECRET=whsec_YOUR_SIGNING_SECRET_FROM_STEP_1

# Supabase Database
NEXT_PUBLIC_SUPABASE_URL=https://yirjulakkgignzbrqnth.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Replicate AI
REPLICATE_API_TOKEN=your_replicate_api_token_here
```

5. **Important**: Set environment for **Production**, **Preview**, and **Development**
6. Click **Save**

---

### **STEP 3: Create Database Tables in Supabase** 💾

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard/project/yirjulakkgignzbrqnth
2. **Click**: **SQL Editor** (left sidebar)
3. **Click**: **New Query**
4. **Copy** the entire content from: `c:\444Radio\supabase-schema.sql`
5. **Paste** into the SQL editor
6. **Click**: **RUN** (or Ctrl/Cmd + Enter)
7. **Verify**:
   - Go to **Table Editor**
   - You should see: `users`, `songs`, `likes`, `comments`, `playlists`, `playlist_songs`

---

## 🚀 DEPLOY TO PRODUCTION

### Option A: Automatic Deploy (Recommended)
```bash
# Just push to GitHub - Vercel auto-deploys!
git add .
git commit -m "feat: add Clerk + Supabase integration"
git push origin master
```

### Option B: Manual Deploy via Vercel CLI
```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Deploy to production
vercel --prod
```

---

## ✅ TEST YOUR PRODUCTION SITE

### 1. **Test Authentication**:
```
✅ Visit: https://444radio.co.in
✅ Click: "Get Started Free"
✅ Create an account
✅ Check: You should be redirected back to homepage
✅ Verify: Music generation form should appear
```

### 2. **Verify Database**:
```
✅ Go to Supabase → Table Editor → users
✅ Your new user should appear automatically!
✅ Check: clerk_user_id, email, username
```

### 3. **Test Music Generation**:
```
✅ Fill out the form (title, prompt, genre, etc.)
✅ Click: "Generate Music"
✅ Check Supabase → songs table
✅ Your generation should be saved!
```

---

## 🔍 WEBHOOK VERIFICATION

To verify webhooks are working:

1. **Create a test user** on https://444radio.co.in/sign-up
2. **Check Clerk Webhook Logs**:
   - Go to: Clerk Dashboard → Webhooks
   - Click your webhook endpoint
   - Check "Attempts" tab
   - Should show: ✅ 200 Success
3. **Check Supabase**:
   - Table Editor → users
   - Your user should appear within seconds!

---

## 🐛 TROUBLESHOOTING

### If Webhooks Fail:
```bash
# Check Clerk webhook logs
# Common issues:
# 1. Wrong endpoint URL
# 2. Missing CLERK_WEBHOOK_SECRET in Vercel
# 3. Supabase RLS policies blocking inserts

# Fix: Redeploy after adding env vars
vercel --prod
```

### If Sign-In Redirects to localhost:
```bash
# Fix Clerk redirect URLs:
# Dashboard → Settings → Paths
# Change all localhost:3000 → 444radio.co.in
```

### If Database Insert Fails:
```bash
# Check Supabase Logs:
# Dashboard → Logs → Database
# Look for: INSERT errors or RLS policy violations
```

---

## 📊 MONITORING

### Clerk Dashboard:
- **Users**: Monitor sign-ups and active users
- **Webhooks**: Check webhook delivery status
- **Analytics**: View authentication metrics

### Supabase Dashboard:
- **Table Editor**: View all data
- **Logs**: Monitor database queries
- **API**: Check API usage

### Vercel Dashboard:
- **Deployments**: Monitor build status
- **Analytics**: View site traffic
- **Logs**: Check runtime logs

---

## 🎉 WHAT YOU'LL HAVE AFTER THIS

✅ **Live Authentication**: Users can sign up at https://444radio.co.in/sign-up
✅ **Automatic User Sync**: Clerk → Supabase webhook working
✅ **Protected Routes**: Only authenticated users see music form
✅ **Database Ready**: All tables with proper RLS policies
✅ **Music Generation**: Ready to save to database
✅ **Glass Morphism UI**: Beautiful Matrix-themed design
✅ **Production Ready**: No localhost dependencies!

---

## 🚀 NEXT FEATURES TO BUILD

After this setup works:

1. **Music Library Page**: Display user's generated songs
2. **Profile Page**: User settings and preferences
3. **Community Feed**: Show all public songs
4. **Payment Integration**: Razorpay for premium features
5. **Audio Player**: Play generated music
6. **Download Feature**: Let users download their tracks
7. **Social Features**: Likes, comments, sharing

---

## 📝 QUICK REFERENCE

```bash
# Local Development
npm run dev

# Build for Production
npm run build

# Deploy to Vercel
git push origin master

# Check Logs
vercel logs --prod

# Check Environment Variables
vercel env ls
```

---

## 🔐 SECURITY CHECKLIST

✅ All environment variables in Vercel (not in code)
✅ Webhook secret configured
✅ Supabase RLS policies enabled
✅ HTTPS only (automatically via Vercel)
✅ Clerk authentication protecting API routes
✅ No API keys exposed in client-side code

---

**Ready to deploy? Follow the 3 steps above and your site will be fully production-ready! 🚀**

Questions? Check:
- Clerk Docs: https://clerk.com/docs
- Supabase Docs: https://supabase.com/docs
- Vercel Docs: https://vercel.com/docs
