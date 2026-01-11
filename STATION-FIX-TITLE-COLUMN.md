# Station Page Fix - Title Column Missing

## Issue
The station page was broken because the `live_stations` table was missing the `title` column that the API route expects.

## Root Cause
- `/app/api/station/route.ts` line 73 tries to access `stationData?.title`
- The `live_stations` table schema didn't have this column
- This caused the API to fail when checking if a station is live

## Fix Applied

### 1. Database Migration
Created: `db/migrations/017_add_title_to_live_stations.sql`
```sql
ALTER TABLE live_stations ADD COLUMN IF NOT EXISTS title TEXT;
CREATE INDEX IF NOT EXISTS idx_live_stations_title ON live_stations(title);
```

### 2. How to Apply (Manual Step Required)

**You need to run this SQL in Supabase Dashboard:**

1. Go to https://supabase.com/dashboard
2. Select your 444Radio project
3. Go to SQL Editor
4. Run this query:

```sql
ALTER TABLE live_stations ADD COLUMN IF NOT EXISTS title TEXT;
CREATE INDEX IF NOT EXISTS idx_live_stations_title ON live_stations(title);
```

5. Verify with:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'live_stations';
```

### 3. Code Review
The station page code is actually correct and has proper fallbacks:
- Line 82: `setStreamTitle(data.title || `${djUsername}'s Station`)`
- The code anticipates that title might be null/undefined

## Verification
After running the SQL:
1. Visit https://www.444radio.co.in/station
2. Try going live
3. Check if the station page loads without errors
4. Verify chat and viewer count work

## Status
- ✅ Migration file created
- ⏳ Manual SQL execution required (Supabase dashboard)
- ⏳ Deployment pending
