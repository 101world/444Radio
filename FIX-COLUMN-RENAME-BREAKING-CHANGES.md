# Fix: Column Rename Breaking Changes

## Issue
After running migration `100.5_rename_user_id_to_clerk_user_id.sql`, the live stations API started returning 500 errors. The migration renamed `user_id` → `clerk_user_id` in 6 tables, but the application code was still using the old column names.

## Root Cause
Migration 100.5 renamed columns in these tables:
- `live_stations`
- `station_messages`
- `station_listeners`
- `play_credits`
- `studio_jobs`
- `studio_projects`

All API routes referencing these tables needed to be updated to use `clerk_user_id` instead of `user_id`.

## Files Fixed

### 1. app/api/station/route.ts
**Changes:**
- Line 72: `.eq('user_id', ...)` → `.eq('clerk_user_id', ...)`
- Line 89: `.eq('user_id', ...)` → `.eq('clerk_user_id', ...)`
- Line 115: `s.user_id` → `s.clerk_user_id`
- Line 133: `station.user_id` → `station.clerk_user_id`
- Line 188: `.eq('user_id', ...)` → `.eq('clerk_user_id', ...)`
- Line 214: `.eq('user_id', ...)` → `.eq('clerk_user_id', ...)`
- Line 234: `.eq('user_id', ...)` → `.eq('clerk_user_id', ...)`
- Line 264: `user_id: userId` → `clerk_user_id: userId`

**Impact:** Fixed 500 error when checking station status, updating stations, and fetching all live stations.

### 2. app/api/station/messages/route.ts
**Changes:**
- Line 29: `.select('user_id')` → `.select('clerk_user_id')`
- Line 41: `user_id: userId` → `clerk_user_id: userId`
- Line 54: `stationData.user_id` → `stationData.clerk_user_id`
- Line 61: `stationData.user_id` → `stationData.clerk_user_id`

**Impact:** Fixed message broadcasting and persistence for live stations.

### 3. app/api/station/listeners/route.ts
**Changes:**
- Line 43: `user_id: userId` → `clerk_user_id: userId`
- Line 49: `'station_id,user_id'` → `'station_id,clerk_user_id'` (onConflict clause)
- Line 88: `.eq('user_id', userId)` → `.eq('clerk_user_id', userId)`

**Impact:** Fixed listener tracking (join/leave station).

### 4. app/api/studio/projects/route.ts
**Changes:**
- Line 53: `.eq('user_id', userId)` → `.eq('clerk_user_id', userId)`
- Line 141: `.eq('user_id', userId)` → `.eq('clerk_user_id', userId)`
- Line 190: `user_id: userId` → `clerk_user_id: userId`
- Line 282: `.eq('user_id', userId)` → `.eq('clerk_user_id', userId)`

**Impact:** Fixed DAW project operations (GET, POST, PATCH, DELETE).

### 5. app/api/studio/jobs/[jobId]/route.ts
**Changes:**
- Line 37: `.eq('user_id', userId)` → `.eq('clerk_user_id', userId)`

**Impact:** Fixed job status retrieval security check.

### 6. app/api/studio/generate/route.ts
**Changes:**
- Line 122: `user_id: userId` → `clerk_user_id: userId`

**Impact:** Fixed studio job creation for AI generation.

### 7. app/api/studio/webhook/route.ts
**Changes:**
- Line 128: `job.user_id` → `job.clerk_user_id` (broadcast on failure)
- Line 150: `job.user_id` → `job.clerk_user_id` (broadcast on completion)

**Impact:** Fixed Pusher event broadcasts for job status updates.

## Testing Checklist

### Live Stations
- [ ] Check station status by username
- [ ] Get all live stations
- [ ] Create new station (go live)
- [ ] Update station (change track)
- [ ] Stop station (go offline)

### Station Interactions
- [ ] Join station as listener
- [ ] Leave station
- [ ] Send message to station
- [ ] View station messages

### Studio/DAW
- [ ] List user projects
- [ ] Create new project
- [ ] Update existing project
- [ ] Delete project
- [ ] Generate AI audio (stem split, effects, etc.)
- [ ] Check job status
- [ ] Receive Replicate webhook updates

## Prevention
To prevent similar issues in future migrations:
1. Always search for all references to a column before renaming: `grep -r "old_column_name" app/`
2. Update TypeScript types if they exist
3. Run `npm run typecheck` before deploying
4. Add API integration tests for critical endpoints

## Related Migrations
- `100.5_rename_user_id_to_clerk_user_id.sql` - The migration that renamed columns
- `101_fix_remaining_security_warnings.sql` - Updated RLS policies to use new column names
- `102_fix_remaining_functions.sql` - Pending migration for function security warnings

## Status
✅ All TypeScript errors resolved
✅ All API routes updated
⚠️ Requires deployment to test in production
⚠️ Migration 102 still pending execution (unrelated to this issue)
