# 🚀 Like System Deployment Guide

## Current Status
❌ **Like system NOT working** - Migration not deployed to database yet

## Quick Fix (5 minutes)

### Step-by-Step Instructions:

#### 1️⃣ Open Supabase SQL Editor
1. Go to: https://supabase.com/dashboard
2. Select your **444Radio** project
3. Click **"SQL Editor"** in the left sidebar (looks like `</>`)
4. Click **"New Query"** button (top right)

#### 2️⃣ Run the Migration
1. Open the file: `DEPLOY_LIKES_MIGRATION.sql` (in your project root)
2. **Copy the ENTIRE file** (Ctrl+A, Ctrl+C)
3. **Paste** into the Supabase SQL Editor
4. Click **"Run"** (or press `Ctrl+Enter`)
5. Wait 2-3 seconds for it to complete

#### 3️⃣ Verify It Worked
You should see:
```
Like system migration completed successfully! 🎉
```

If you see **errors**, copy them and let me know.

#### 4️⃣ Test the Like System
1. Go to your app: https://444radio.co.in
2. **Hard refresh**: Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
3. Click a **heart icon** on any track
4. The heart should fill **red** and the count should increase
5. Click again - it should unfill (unlike)

#### 5️⃣ Debug Check (Optional)
Visit: https://444radio.co.in/api/debug/likes

You should see:
```json
{
  "success": true,
  "migration_status": "✅ Migration deployed successfully",
  "schema": {
    "user_likes_table_exists": true,
    "likes_count_column_exists": true
  }
}
```

---

## Alternative: Use Vercel Build Migrations (Not Recommended)

If you want migrations to run automatically on Vercel builds:

1. Go to Vercel dashboard
2. Your 444Radio project → Settings → Environment Variables
3. Add:
   - `PG_CONNECTION_STRING` = `postgresql://user:password@host:5432/database`
   - (Get this from Supabase → Settings → Database → Connection String → URI)
4. Redeploy your app

**But this is slower** - just use the SQL Editor method above.

---

## What the Migration Does

Creates:
- ✅ `user_likes` table - tracks who liked what
- ✅ `likes_count` column on `combined_media` - cached count
- ✅ Automatic trigger - updates count when likes added/removed
- ✅ Indexes - for fast queries
- ✅ RLS policies - security (though API uses Service Role Key)

---

## Troubleshooting

### "relation 'combined_media' does not exist"
- Your database doesn't have the main table yet
- Check if you're using the correct Supabase project

### "permission denied"
- Make sure you're logged into Supabase with admin access
- The SQL Editor has full permissions by default

### Heart button does nothing
1. Check browser console (F12) for errors
2. Visit `/api/debug/likes` to check migration status
3. Make sure you're signed in to your app

### Already ran it but getting errors
- The migration is idempotent (safe to run multiple times)
- It uses `IF NOT EXISTS` and `DROP IF EXISTS` to avoid conflicts

---

## Files Changed
- ✅ `db/migrations/005_add_likes_system.sql` - Original migration
- ✅ `DEPLOY_LIKES_MIGRATION.sql` - **USE THIS ONE** for Supabase
- ✅ `app/api/media/like/route.ts` - Like/unlike API
- ✅ `app/api/library/liked/route.ts` - Fetch liked songs
- ✅ `app/components/LikeButton.tsx` - UI component
- ✅ `app/api/debug/likes/route.ts` - Debug endpoint

---

## After Migration Works

Features that will be enabled:
1. ❤️ Like button on Explore page
2. ❤️ Like button on Profile pages
3. 📋 Liked Songs tab in Library
4. 🔢 Real-time like counts
5. 💾 Persistent likes (saved to database)

---

**Need help?** Share any error messages you see!
