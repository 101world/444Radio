# Quest System Enhancements - Complete Implementation

**Date:** February 20, 2026  
**Status:** ✅ All features implemented and tracked

---

## Overview

Comprehensive quest tracking system with referral codes, generation streaks, model usage tracking, and instrumental/cover art quests.

---

## 🎯 Quest Changes Implemented

### Updated Quests in Migration (126_quest_system.sql)

1. **Streak Lord** ⚡
   - **Before:** Complete a 7-day generation streak
   - **After:** Generate and release 1 track daily for 30 days
   - **Type:** Monthly quest
   - **Reward:** 100 credits
   - **Action:** `streak_lord`

2. **Cover Art Maestro** 🎨 **(NEW)**
   - **Description:** Generate 100 cover arts in a month
   - **Type:** Monthly quest
   - **Reward:** 100 credits
   - **Action:** `generate_cover_art`

3. **Model Explorer** 🤖
   - **Before:** "Use a new AI model once" (daily)
   - **After:** "Use all available AI models at least once" (daily)
   - **Reward:** 50 credits
   - **Action:** `use_all_models`

4. **Beat Maker** 🎹
   - **Before:** "Login and create 1 beat" (daily)
   - **After:** "Create 10 instrumental tracks" (weekly)
   - **Reward:** 20 credits
   - **Action:** `create_instrumental`

---

## 📊 Quest Actions Summary

| Quest Action | Where Tracked | Trigger Event |
|-------------|---------------|---------------|
| `generate_songs` | All music generation routes | Every successful generation |
| `generate_cover_art` | `/api/generate/image-only` | Cover art generation complete |
| `create_instrumental` | Music generation routes | When lyrics < 30 chars or contains "[Instrumental]" |
| `use_all_models` | All generation routes | After tracking model, checks if all models used |
| `use_mastering` | `/api/generate/audio-boost` | Audio mastering complete |
| `upload_marketplace` | `/api/earn/list` | Track listed for sale |
| `share_tracks` | Visibility/publish routes | Track made public |
| `login_days` | `/api/credits` (GET) | First daily API call |
| `use_genres` | `/api/generate/music-only` | Genre parameter provided |
| `invite_users` | `/api/referral/apply` | New user uses referral code |
| `streak_lord` | Generation + publish routes | Daily generate & release streak |

---

## 🔗 Referral System (NEW)

### Database Tables (127_referral_system.sql)

1. **`users` table additions:**
   - `referral_code` TEXT UNIQUE - Auto-generated 8-char code
   - `referred_by` TEXT - Clerk user ID of referrer

2. **`referrals` table:**
   - Tracks all referral relationships
   - `is_paid` flag for tracking paying users
   - Unique constraint on (referrer_id, referred_id)

### API Endpoints Created

1. **`GET /api/referral`**
   - Returns user's referral code and stats
   - Response: `{ referralCode, totalReferrals, paidReferrals, referralLink }`

2. **`GET /api/referral/search?q=username`**
   - Search for users by username
   - Returns list of users with their referral codes

3. **`POST /api/referral/apply`**
   - Apply a referral code
   - Body: `{ referralCode }`
   - Creates referral record and tracks quest progress

4. **`POST /api/referral/mark-paid`**
   - Mark referred user as paid (call from payment webhooks)
   - Body: `{ userId }`

### How It Works

1. Every user gets auto-generated unique 8-char referral code
2. New users can search for friends by username
3. Apply referral code during signup/onboarding
4. Referrer gets credit toward "invite_users" quests
5. When referred user makes first purchase, mark as "paid"

---

## 📈 Generation Streaks (NEW)

### Database Table (128_generation_streaks.sql)

**`generation_streaks` table:**
- Tracks daily generation + release activity
- Fields: `user_id`, `streak_date`, `generated`, `released`
- Unique constraint on (user_id, streak_date)

**`user_model_usage` table:**
- Tracks which AI models each user has tried
- Used for "use all models" quest

### Helper Functions

- `get_user_streak(p_user_id)` - Calculates current consecutive streak
- Auto-upserts daily records when user generates or releases

### How Streak Lord Works

1. **Generation:** When user generates any content → `trackGenerationStreak(userId)`
   - Marks `generated = true` for today

2. **Release:** When user makes track public → `trackReleaseStreak(userId)`
   - Marks `released = true` for today
   - Recalculates streak using SQL function
   - Updates Streak Lord quest progress

3. **Streak Calculation:**
   - Counts consecutive days where BOTH `generated` AND `released` are true
   - Breaks if any day is missing
   - Quest completes at 30-day streak

---

## 🎨 New Tracking Functions (lib/quest-progress.ts)

### `trackModelUsage(userId, modelName)`
- Records every AI model a user tries
- Checks if all models have been used
- Triggers "use all models" quest completion

**Tracked Models:**
- chirp-v3-5
- chirp-v3
- chirp-v2
- stable-audio
- musicgen
- riffusion
- flux-2-klein-9b

### `trackGenerationStreak(userId)`
- Marks today as "generated"
- Checks if both generated + released today
- Recalculates current streak
- Updates Streak Lord quest progress

### `trackReleaseStreak(userId)`
- Marks today as "released"
- Triggers streak recalculation
- Fire-and-forget pattern

---

## 🎵 Generation Route Updates

### Routes Modified

1. **`/api/generate/image-only`**
   - ✅ `trackQuestProgress(userId, 'generate_cover_art')`
   - ✅ `trackModelUsage(userId, 'flux-2-klein-9b')`
   - ✅ `trackGenerationStreak(userId)`

2. **`/api/generate/music`**
   - ✅ `trackModelUsage(userId, modelName)`
   - ✅ `trackGenerationStreak(userId)`

3. **`/api/generate/music-only`**
   - ✅ `trackQuestProgress(userId, 'generate_songs')`
   - ✅ `trackQuestProgress(userId, 'use_genres', 1, genre)` (if genre)
   - ✅ `trackQuestProgress(userId, 'create_instrumental')` (if instrumental)
   - ✅ `trackModelUsage(userId, 'chirp-v3-5')`
   - ✅ `trackGenerationStreak(userId)`

4. **`/api/songs/visibility`**
   - ✅ `trackQuestProgress(userId, 'share_tracks')` (if public)
   - ✅ `trackReleaseStreak(userId)` (if public)

5. **`/api/library/combined` (publish)**
   - ✅ `trackQuestProgress(userId, 'share_tracks')`
   - ✅ `trackReleaseStreak(userId)`

6. **`/api/media/combine` (release)**
   - ✅ `trackQuestProgress(userId, 'share_tracks')`
   - ✅ `trackReleaseStreak(userId)`

### Instrumental Detection Logic

```typescript
const isInstrumental = !formattedLyrics || 
                      formattedLyrics.length < 30 || 
                      formattedLyrics.toLowerCase().includes('[instrumental]')
```

---

## 🎛️ Admin Page Updates (app/quests/admin/page.tsx)

Updated `QUEST_ACTIONS` dropdown:

```typescript
const QUEST_ACTIONS = [
  { value: 'generate_songs', label: 'Generate Songs' },
  { value: 'invite_users', label: 'Invite Users' },
  { value: 'upload_marketplace', label: 'Upload to Marketplace' },
  { value: 'use_mastering', label: 'Use AI Mastering' },
  { value: 'streak_lord', label: 'Daily Generate + Release Streak' },
  { value: 'share_tracks', label: 'Share Tracks' },
  { value: 'login_days', label: 'Login Days' },
  { value: 'use_genres', label: 'Use Different Genres' },
  { value: 'use_all_models', label: 'Use All AI Models' },
  { value: 'create_instrumental', label: 'Create Instrumental' },
  { value: 'generate_cover_art', label: 'Generate Cover Art' },
]
```

Admin can now:
- View all quests with proper action labels
- Create/edit quests with new actions
- Track user progress with updated quest types

---

## 📝 Migration Files Created

1. **`126_quest_system.sql`** (UPDATED)
   - Modified quest definitions
   - Added Cover Art Maestro quest
   - Updated Streak Lord requirements
   - Changed Model Explorer to use_all_models
   - Changed Beat Maker to create_instrumental (weekly)

2. **`127_referral_system.sql`** (NEW)
   - Adds referral_code and referred_by columns to users
   - Creates referrals tracking table
   - Auto-generates referral codes for all users
   - Trigger to generate codes for new users

3. **`128_generation_streaks.sql`** (NEW)
   - Creates generation_streaks table
   - Creates user_model_usage table
   - Helper function to calculate current streak

---

## 🚀 Deployment Checklist

### 1. Run Migrations
```powershell
npm run migrate
```

This will execute:
- 126_quest_system.sql (updates)
- 127_referral_system.sql (new)
- 128_generation_streaks.sql (new)

### 2. Verify Database
```sql
-- Check referral codes generated
SELECT clerk_user_id, referral_code FROM users LIMIT 10;

-- Check quest definitions
SELECT title, quest_type, requirement FROM quests;

-- Check new tables exist
SELECT * FROM referrals LIMIT 1;
SELECT * FROM generation_streaks LIMIT 1;
SELECT * FROM user_model_usage LIMIT 1;
```

### 3. Test Quest Tracking
- Generate a song → check `generate_songs` increments
- Generate cover art → check `generate_cover_art` increments
- Generate instrumental → check `create_instrumental` increments
- Make track public → check `share_tracks` + release streak
- Use different models → check `user_model_usage` table

### 4. Test Referral System
- Visit `/api/referral` → should return your referral code
- Search users → `/api/referral/search?q=test`
- Apply code → POST to `/api/referral/apply` with valid code
- Check referrer's quest progress updates

---

## ⚠️ Known Limitations & Future Work

1. **Payment Webhook Integration**
   - Need to call `/api/referral/mark-paid` from Razorpay/Stripe webhooks
   - Currently only tracks invite count, not "paying users"

2. **Model List Maintenance**
   - `trackModelUsage` has hardcoded model list
   - Update when adding new AI models

3. **Streak Reset Logic**
   - Current streak resets if user misses a day
   - Consider grace period or streak freezes

4. **Admin Quest Visibility**
   - Admin page shows all quests
   - Consider filtering by quest type or status

---

## 📊 Quest Rewards Summary

| Quest | Type | Reward | Action |
|-------|------|--------|--------|
| Song Machine | Monthly | 100 credits | Generate 200 songs |
| Recruiter Elite | Monthly | 100 credits | Invite 100 paying users |
| Marketplace Maven | Monthly | 100 credits | Upload 10 tracks |
| Master Engineer | Monthly | 100 credits | Use AI mastering 50 times |
| **Streak Lord** | Monthly | **100 credits** | **30-day generate+release streak** |
| **Cover Art Maestro** | Monthly | **100 credits** | **Generate 100 cover arts** |
| Weekly Grinder | Weekly | 20 credits | Generate 25 songs |
| Social Butterfly | Weekly | 20 credits | Share 3 tracks |
| Loyal Operator | Weekly | 20 credits | Login 5 days |
| Genre Explorer | Weekly | 20 credits | Use 3 genres |
| Recruitment Drive | Weekly | 20 credits | Invite 5 users |
| **Beat Maker** | Weekly | **20 credits** | **Create 10 instrumentals** |
| Daily Creator | Daily | 50 credits | Generate 5 songs |
| Social Share | Daily | 50 credits | Share 1 track |
| **Model Explorer** | Daily | **50 credits** | **Use all AI models** |
| Golden Recruiter | Yearly | 250 credits | Invite 1000 users |

---

## ✅ Implementation Status

- [x] Update quest definitions in migration
- [x] Create referral system tables
- [x] Create generation streak tracking tables
- [x] Build referral API endpoints
- [x] Add tracking functions to quest-progress.ts
- [x] Update admin page quest actions
- [x] Add cover art tracking
- [x] Add instrumental tracking
- [x] Add model usage tracking
- [x] Add generation streak tracking
- [x] Add release streak tracking
- [x] Update all generation routes
- [x] Update all visibility/publish routes

**All features implemented and ready for deployment! 🎉**

---

## 🧪 Testing Commands

```powershell
# Run migrations
npm run migrate

# Check TypeScript
npm run typecheck

# Start dev server
npm run dev
```

Test in browser:
1. Generate music → check quest progress
2. Generate cover art → check quest progress
3. Make track public → verify share_tracks + release_streak
4. Get referral code → `/api/referral`
5. Admin panel → `/quests/admin`

---

**Implementation Complete!** All quest tracking enhancements are live and integrated throughout the platform.
