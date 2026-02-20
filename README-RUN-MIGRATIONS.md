# 🚀 How to Run the Migrations in Supabase

Your UI fix is already deployed (commit 27d03d7) ✅. Now you just need to run these 3 SQL files in Supabase to add the missing credits.

---

## Step 1: Open Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New Query"**

---

## Step 2: Run Migration Files (In Order)

### 📄 STEP-1-CREATE-SYSTEM.sql (Run First)

1. Open the file: `STEP-1-CREATE-SYSTEM.sql`
2. **Copy the ENTIRE file**
3. Paste into Supabase SQL Editor
4. Click **"Run"**
5. ✅ Should see: "Functions created", "Table created"

**What this does:**
- Creates `award_credits()` RPC function
- Creates `admin_notifications` table
- Sets up audit trigger
- Creates reconciliation functions

---

### 📄 STEP-2-AWARD-CREDITS.sql (Run Second)

1. Open the file: `STEP-2-AWARD-CREDITS.sql`
2. **Copy the ENTIRE file**
3. Paste into Supabase SQL Editor
4. Click **"Run"**
5. ✅ Should see: "Successfully upgraded X users with +24 free credits"
6. ✅ Verification table shows `free_credits = 24`

**What this does:**
- Awards +24 free_credits to all users who redeemed "FREE THE MUSIC"
- Logs transactions automatically
- Creates user notifications

---

### 📄 STEP-3-ADMIN-NOTIFICATION.sql (Run Third)

1. Open the file: `STEP-3-ADMIN-NOTIFICATION.sql`
2. **Copy the ENTIRE file**
3. Paste into Supabase SQL Editor
4. Click **"Run"**
5. ✅ Should see: "Admin notified", summary statistics

**What this does:**
- Sends you an admin notification
- Shows total credits distributed
- Shows 444B pool remaining
- Runs system health check

---

## Step 3: Verify in Your App

1. Refresh your 444Radio settings page
2. Go to **Settings → Credits** tab
3. ✅ Should now show: **35 credits** (11 paid + 24 free)

---

## If Something Goes Wrong

### Error: "relation admin_notifications does not exist"
- You skipped Step 1. Run `STEP-1-CREATE-SYSTEM.sql` first.

### Error: "function award_free_credits does not exist"
- This is expected if migration 130 wasn't run. The system will fall back to direct updates.
- Check if migration 130 exists in your database.

### Credits still showing wrong balance
1. Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Check the verification query at the end of Step 2
3. If `free_credits` column shows 24, but UI doesn't update:
   - Clear browser cache
   - Wait 30 seconds for context to refresh

---

## What You'll See After

**Settings Page → Credits Tab:**
```
Available Credits
       35
11 paid + 24 free
```

**Admin Notifications (if you add the UI):**
```
🎵 Free the Music Upgrade Complete
Successfully distributed 240 credits to 10 users...
```

**System Status:**
- ✅ All credits tracked in 444B pool
- ✅ Audit trigger watching for untracked additions
- ✅ Free credits deducted first during generation

---

## Files in This Folder

- `STEP-1-CREATE-SYSTEM.sql` - Creates bulletproof tracking infrastructure
- `STEP-2-AWARD-CREDITS.sql` - Awards the missing +24 free_credits
- `STEP-3-ADMIN-NOTIFICATION.sql` - Sends admin summary notification
- `README-RUN-MIGRATIONS.md` - This file

All files are **copy-paste ready**. No markdown, just pure SQL! 🎵
