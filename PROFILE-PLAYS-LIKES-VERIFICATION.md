# Profile Plays/Likes - Verification & Fix Guide

## ✅ Code Status: VERIFIED AND PUSHED

The plays/likes display **IS in the codebase** at:
- **File**: `app/profile/[userId]/page.tsx`
- **Lines**: 1073-1083 (Desktop view) and similar in mobile view
- **Commit**: a30a52f

### Code Snippet (from line 1073):
```tsx
<div className="flex items-center gap-2 text-xs text-gray-500">
  <div className="flex items-center gap-1">
    <Play size={10} />
    <span>{media.plays || 0}</span>
  </div>
  <div className="flex items-center gap-1">
    <Heart size={10} />
    <span>{media.likes || 0}</span>
  </div>
</div>
```

---

## 🔍 Why You Might Not See It

### Issue 1: Database Migrations Not Run ⚠️

The `combined_media` table needs a `likes` column.

**Check if migration was run:**
```sql
-- Run this in Supabase SQL Editor
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'combined_media' 
AND column_name IN ('plays', 'likes');
```

**Expected Result:**
```
column_name | data_type
------------|----------
plays       | integer
likes       | integer
```

**If missing, run migration:**

**Option A - Via npm (PowerShell):**
```powershell
$env:PG_CONNECTION_STRING = "postgresql://user:pass@host:port/database"
npm run migrate
```

**Option B - Via Supabase Dashboard:**
1. Open Supabase SQL Editor
2. Paste contents of `db/migrations/002_add_likes_to_combined_media.sql`
3. Click "Run"

---

### Issue 2: All Plays/Likes Are Zero

If the columns exist but show "0", that's expected for:
- Newly created content
- Content created before the migration

**To test with dummy data:**
```sql
-- Add some test plays/likes to see if UI updates
UPDATE combined_media 
SET plays = 123, likes = 45 
WHERE user_id = 'your_clerk_user_id' 
LIMIT 3;
```

Then refresh the profile page - you should see the numbers appear.

---

### Issue 3: Browser Cache

If code is correct and data exists but you still don't see it:

**Clear cache and hard reload:**
- **Chrome/Edge**: Ctrl + Shift + R
- **Firefox**: Ctrl + F5
- **Or**: Open DevTools (F12) → Right-click refresh button → "Empty Cache and Hard Reload"

---

## 🎯 Current Profile Layout (What You Should See)

Based on commit a30a52f, the profile page has:

1. **Banner/Carousel** (top) - Shows custom banner OR cover art carousel
2. **Station Button** (if live or own profile)
3. **"🎵 Recent Tracks"** - Horizontal scroll of 20 recent tracks
4. **"📀 All Tracks" / "📝 All Posts"** tabs
5. **Track List** with:
   - Thumbnail
   - Title
   - Username
   - **▶ plays count** ← Should be here
   - **♥ likes count** ← Should be here

---

## 🛠️ Quick Fix Steps

### Step 1: Verify You're on Latest Code
```powershell
git status
git log --oneline -1
```

**Expected**: Commit `e3430ba` or later

### Step 2: Run Migrations
```powershell
# Set your Supabase connection string
$env:PG_CONNECTION_STRING = "postgresql://postgres.xxx:pass@aws-0-region.pooler.supabase.com:6543/postgres"

# Run migrations
npm run migrate
```

**Expected output:**
```
Running migrations...
✓ 001_add_last_444_radio_date.sql
✓ 002_add_likes_to_combined_media.sql
✓ 003_add_banner_to_users.sql
✓ 004_create_studio_projects.sql
```

### Step 3: Verify Data in Database
```sql
-- Check if likes column exists
SELECT id, title, plays, likes 
FROM combined_media 
LIMIT 5;
```

If you see `column "likes" does not exist`, migrations didn't run.

### Step 4: Test in Browser
1. Go to your profile: `http://localhost:3000/profile/[your-clerk-id]`
2. Look at "All Tracks" section
3. Each track should show small icons: ▶ 0  ♥ 0

### Step 5: Add Test Data (Optional)
```sql
-- Give your first 3 tracks some plays/likes
UPDATE combined_media 
SET plays = 100, likes = 25 
WHERE user_id = 'user_xxx' 
ORDER BY created_at DESC 
LIMIT 3;
```

Refresh page - numbers should update.

---

## 📸 What You Should See vs. What You're Seeing

### ❌ What You Described Seeing:
- Vinyl player (?)
- Recent Tracks horizontal scroll ✅ (this is correct)
- NO plays/likes counters ❌

### ✅ What Should Actually Be There:
- Banner or carousel at top ✅
- Station button (if applicable) ✅
- "🎵 Recent Tracks" horizontal scroll ✅
- "📀 All Tracks" tab ✅
- Each track with tiny ▶ icon + number and ♥ icon + number ✅

---

## 🚨 If Still Not Working

### Debug Checklist:

1. **Open browser DevTools** (F12)
2. **Go to your profile page**
3. **Check Network tab** - Look for call to `/api/media/profile/[userId]`
4. **Check Response** - Does it include `plays` and `likes` fields?

**Example good response:**
```json
{
  "combinedMedia": [
    {
      "id": "...",
      "title": "My Track",
      "plays": 123,      // ← Should be here
      "likes": 45,       // ← Should be here
      "audio_url": "...",
      "image_url": "..."
    }
  ]
}
```

If `plays`/`likes` are **missing from API response**, then:
- Migration didn't run
- Wrong table/column names

If `plays`/`likes` are **in API response** but not showing on page:
- React state issue
- Browser cache
- Wrong conditional rendering

---

## 🔄 Full Reset (If Desperate)

```powershell
# 1. Pull latest code
git pull origin master
git submodule update --init --recursive

# 2. Reinstall
rm -r node_modules, package-lock.json
npm install

# 3. Run migrations
$env:PG_CONNECTION_STRING = "your-connection-string"
npm run migrate

# 4. Clear browser completely
# Close all tabs, clear cache, restart browser

# 5. Start fresh
npm run dev
```

---

## 📞 Next Steps

1. **Run the database migration** (Step 2 above)
2. **Add test data** (Step 5 above)
3. **Hard refresh browser** (Ctrl + Shift + R)
4. **Take a screenshot** of what you see and share it

The code IS there. The issue is likely:
- Database doesn't have the columns (migration not run)
- OR plays/likes are all 0 (need test data)
- OR browser showing cached old version

**Run the migration first**, then let me know what you see! 🎯
