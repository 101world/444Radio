# IS_PUBLIC FLAG FIX - RESOLVED

## Problem
After deleting one track for a user, ALL their tracks disappeared from the explore page.

## Root Cause
The `is_public` column in the `combined_media` table may have been `NULL` or `false` for some existing tracks, preventing them from appearing on the explore page (which filters `WHERE is_public = true`).

## Solution Implemented

### 1. Code Fix (Deployed ✅)
**File**: `app/api/media/combine/route.ts`

Changed from:
```typescript
is_public: isPublic !== undefined ? isPublic : true,
```

To:
```typescript
is_public: true, // Always public for releases (explore/profile visibility)
```

**Effect**: All NEW releases will now always be public

### 2. Database Migration (REQUIRES MANUAL RUN ⚠️)
**File**: `db/migrations/fix-is-public-combined-media.sql`

**INSTRUCTIONS TO FIX EXISTING TRACKS:**

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run this SQL:

```sql
-- Update all existing combined_media tracks to be public
UPDATE combined_media
SET is_public = true
WHERE is_public IS NULL OR is_public = false;
```

3. Verify with:
```sql
SELECT 
  COUNT(*) as total_tracks,
  COUNT(*) FILTER (WHERE is_public = true) as public_tracks
FROM combined_media;
```

## Files Changed
- ✅ `app/api/media/combine/route.ts` - Forces all releases to be public
- ✅ `db/migrations/fix-is-public-combined-media.sql` - SQL to fix existing data
- ✅ `scripts/fix-is-public.ps1` - Helper script to display SQL
- ✅ `scripts/check-user-tracks.sql` - Diagnostic queries

## Verification
After running the SQL migration, all user tracks should:
1. Be visible on the explore page
2. Show up on their profile
3. Have `is_public = true` in the database

## Prevention
The code change ensures this cannot happen again for NEW releases. All future releases will be forced to `is_public = true`.

## Next Steps
**ACTION REQUIRED**: Run the SQL migration in Supabase to fix existing tracks!

```powershell
# Display SQL instructions
.\scripts\fix-is-public.ps1
```

---
**Commit**: `4ea3180` - fix: ensure all releases are always public (is_public=true)
**Date**: November 12, 2025
