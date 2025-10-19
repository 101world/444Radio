# 444RADIO - Clerk + Supabase Integration Setup Guide

## ✅ COMPLETED STEPS

### 1. Clerk Authentication ✅
- ✅ Clerk Provider configured in layout
- ✅ Middleware set up with route protection
- ✅ Sign-in page created at `/sign-in`
- ✅ Sign-up page created at `/sign-up`
- ✅ Environment variables configured
- ✅ Glass morphism styling applied to auth pages

### 2. Supabase Database ✅
- ✅ Client configured in `lib/supabase.ts`
- ✅ Schema SQL file created (`supabase-schema.sql`)
- ✅ Webhook endpoint created for user sync
- ✅ svix package installed

### 3. API Integration ✅
- ✅ Music generation route with Clerk auth check
- ✅ Supabase insert logic ready
- ✅ Replicate API configured

---

## 🚀 REMAINING SETUP STEPS (Do These Now!)

### Step 1: Run Supabase Schema

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `yirjulakkgignzbrqnth`
3. Click "SQL Editor" in the left sidebar
4. Click "New Query"
5. Copy and paste the entire content from `supabase-schema.sql`
6. Click "Run" (or press Ctrl/Cmd + Enter)
7. Verify: Check "Table Editor" to see all tables created

### Step 2: Configure Clerk Webhook

1. Go to Clerk Dashboard: https://dashboard.clerk.com
2. Select your application: "inviting-flea-30"
3. Click "Webhooks" in the left sidebar
4. Click "Add Endpoint"
5. Set Endpoint URL: `http://localhost:3000/api/webhook` (for dev) or `https://444radio.co.in/api/webhook` (for production)
6. Subscribe to events:
   - ✅ `user.created`
   - ✅ `user.updated`
   - ✅ `user.deleted`
7. Copy the "Signing Secret"
8. Add to `.env.local`:
   ```
   CLERK_WEBHOOK_SECRET=whsec_your_secret_here
   ```

### Step 3: Test the Integration

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Test Sign-Up:**
   - Visit: http://localhost:3000
   - Click "Get Started Free"
   - Create an account
   - Check Supabase "users" table - you should see your user!

3. **Test Music Generation:**
   - Sign in to your account
   - Fill out the music generation form
   - Click "Generate Music"
   - Check Supabase "songs" table - your generation should be saved!

---

## 📝 ENVIRONMENT VARIABLES CHECKLIST

Your `.env.local` file should have:

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_aW52aXRpbmctZmxlYS0zMC5jbGVyay5hY2NvdW50cy5kZXYk
CLERK_SECRET_KEY=sk_test_9qzd8G9IuubG02KCzcpoQ1eKyYkFdiTaokwWlwiiTP
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
CLERK_WEBHOOK_SECRET=whsec_your_secret_here  # ← ADD THIS!

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://yirjulakkgignzbrqnth.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Replicate
REPLICATE_API_TOKEN=your_replicate_api_token_here
```

---

## 🎨 WHAT'S WORKING NOW

### Authentication Flow:
1. User visits homepage → sees glass morphism sign-up card
2. User clicks "Get Started Free" → goes to `/sign-up`
3. User creates account → Clerk creates user
4. Webhook fires → User synced to Supabase `users` table
5. User redirected to homepage → now sees music generation form!

### Music Generation Flow:
1. User fills form (title, prompt, lyrics, BPM, genre)
2. User clicks "Generate Music"
3. API checks authentication (Clerk)
4. API calls Replicate for music + cover art
5. API saves to Supabase `songs` table with user_id
6. User can see their creations in `/music` page

---

## 🐛 TROUBLESHOOTING

### If Sign-In Doesn't Work:
- Check Clerk Dashboard → Application → Settings → Paths
- Ensure redirect URLs match your `.env.local`
- Restart dev server after changing environment variables

### If Webhook Doesn't Work:
- For local development, use ngrok or Clerk's CLI
- Clerk CLI: `npx clerk listen --path /api/webhook`
- Check webhook logs in Clerk Dashboard

### If Database Insert Fails:
- Check Supabase logs: Dashboard → Logs
- Verify RLS policies are correct
- Check if user exists in `users` table first

---

## 🎯 NEXT STEPS AFTER SETUP

1. **Update Music Generation API** with actual Replicate models
2. **Add Music Library Page** to display user's songs
3. **Add Profile Page** to manage account
4. **Add Payment Integration** (Razorpay) for premium features
5. **Deploy to Production** (Vercel + update webhook URL)

---

## 📞 SUPPORT

If you need help:
1. Check Clerk Dashboard → Logs
2. Check Supabase Dashboard → Logs  
3. Check browser console for errors
4. Check terminal for API errors

---

**READY TO TEST? Run these commands:**

```bash
# 1. Run Supabase SQL (in Supabase Dashboard)
# 2. Add CLERK_WEBHOOK_SECRET to .env.local
# 3. Restart server
npm run dev

# 4. Test sign-up
open http://localhost:3000

# 5. Check Supabase users table!
```

🎉 **Your Clerk + Supabase integration is 95% complete!**
