# 🔴 URGENT FIX: Lip-Sync Generation Database Issue

## Problem Identified ✅

Your logs show:
```
🔴 logCreditTransaction: all retries exhausted for generation_lipsync 15
```

**Root Cause**: The `credit_transactions` table has a CHECK constraint that only allows specific transaction types. The type `generation_lipsync` is NOT in the allowed list, so the credit logging fails, which blocks the entire generation process.

## The Issue

When you click "Generate Lip-Sync Video":
1. ✅ Files upload successfully (`/api/upload/lipsync` - 200 OK)
2. ✅ Generation API is called (`/api/generate/lipsync` - 200 OK)
3. ✅ Credits are deducted from user account
4. ❌ **Credit transaction logging fails** (database constraint violation)
5. ❌ Generation stops/fails because the transaction can't be logged

## Quick Fix (Run NOW in Supabase)

### Option 1: Supabase Dashboard (Recommended)

1. Go to **Supabase Dashboard** → Your Project
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste this SQL:

```sql
-- Drop existing constraint
ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_type_check;

-- Re-create with generation_lipsync included
ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_type_check
  CHECK (type IN (
    'generation_music',
    'generation_effects',
    'generation_loops',
    'generation_chords',
    'generation_image',
    'generation_video_to_audio',
    'generation_cover_art',
    'generation_stem_split',
    'generation_audio_boost',
    'generation_autotune',
    'generation_video',
    'generation_lipsync',
    'generation_extract',
    'earn_list',
    'earn_purchase',
    'earn_sale',
    'earn_admin',
    'credit_award',
    'credit_refund',
    'wallet_deposit',
    'wallet_conversion',
    'subscription_bonus',
    'plugin_purchase',
    'code_claim',
    'quest_entry',
    'quest_reward',
    'release',
    'other'
  ));
```

5. Click **Run** (or press Ctrl+Enter)
6. You should see: `Success. No rows returned`

### Option 2: Quick SQL File

Use the prepared file: [FIX-LIPSYNC-TRANSACTION-NOW.sql](FIX-LIPSYNC-TRANSACTION-NOW.sql)

Just copy-paste it into Supabase SQL Editor and run.

## Verification

After running the SQL, verify it worked:

```sql
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'credit_transactions_type_check';
```

You should see `generation_lipsync` in the list.

## What Changed

**Before:**
```sql
CHECK (type IN (
  'generation_music',
  'generation_effects',
  'generation_loops',
  'generation_chords',
  'generation_image',
  'generation_video_to_audio',
  'generation_cover_art',
  'generation_stem_split',
  'generation_audio_boost',
  'generation_autotune',
  'generation_video',
  -- 'generation_lipsync',  ❌ MISSING!
  'generation_extract',
  ...
))
```

**After:**
```sql
CHECK (type IN (
  'generation_music',
  'generation_effects',
  'generation_loops',
  'generation_chords',
  'generation_image',
  'generation_video_to_audio',
  'generation_cover_art',
  'generation_stem_split',
  'generation_audio_boost',
  'generation_autotune',
  'generation_video',
  'generation_lipsync',  ✅ ADDED!
  'generation_extract',
  ...
))
```

## After Running the Fix

1. **No code changes needed** - The app is already correct
2. **Test immediately**:
   - Upload an image + audio in lip-sync modal
   - Click "Generate Lip-Sync Video"
   - Check console logs (you should now see credit transaction logged successfully)
   - Generation should proceed normally

## Why This Happened

This is the same issue that happened before with `generation_autotune` and `generation_video` (migration 132). When adding new generation features, the database constraint must be updated to allow the new transaction type.

## Files Created

1. `db/migrations/133_add_lipsync_transaction_type.sql` - Formal migration (for future reference)
2. `FIX-LIPSYNC-TRANSACTION-NOW.sql` - Quick fix SQL (run this now!)

## Timeline

- **Deploy commit**: 4120af2
- **Status**: Files committed, **database update required**
- **Action**: Run the SQL in Supabase NOW

---

## TL;DR

**Run this in Supabase SQL Editor:**

```sql
ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_type_check;

ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_type_check
  CHECK (type IN (
    'generation_music', 'generation_effects', 'generation_loops', 'generation_chords',
    'generation_image', 'generation_video_to_audio', 'generation_cover_art',
    'generation_stem_split', 'generation_audio_boost', 'generation_autotune',
    'generation_video', 'generation_lipsync', 'generation_extract',
    'earn_list', 'earn_purchase', 'earn_sale', 'earn_admin',
    'credit_award', 'credit_refund', 'wallet_deposit', 'wallet_conversion',
    'subscription_bonus', 'plugin_purchase', 'code_claim',
    'quest_entry', 'quest_reward', 'release', 'other'
  ));
```

Then test lip-sync generation again!
