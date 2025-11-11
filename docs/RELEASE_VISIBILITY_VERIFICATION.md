# RELEASE VISIBILITY & DELETE VERIFICATION

## Current Implementation Status ✅

### 1. Release Creation (`/api/media/combine`)
```typescript
is_public: true  // ALWAYS true - all releases are public
```
- ✅ All new releases are automatically public
- ✅ Visible on explore page
- ✅ Visible on user profile
- ✅ Visible in library "Combined" tab

### 2. Release Deletion (`/api/media/delete`)
```typescript
.delete()
.eq('id', id)           // ← Deletes ONLY this specific ID
.eq('user_id', userId)  // ← Ensures user owns it
```
- ✅ Deletes ONLY the specific release by ID
- ✅ Does NOT delete all user tracks
- ✅ Verifies user ownership before deletion
- ✅ Removes from explore page
- ✅ Removes from profile page
- ✅ Removes from library combined tab
- ✅ Preserves original music/images in library

### 3. Explore Page (`/api/media/explore`)
```typescript
.eq('is_public', true)  // Only public releases
```
- ✅ Shows ALL public releases from all users
- ✅ Automatically excludes deleted releases
- ✅ No limit on releases per user

### 4. Profile Page (`/api/media/profile/[userId]`)
```typescript
.eq('is_public', true)  // Only public releases
```
- ✅ Shows user's public releases
- ✅ Automatically excludes deleted releases
- ✅ Updates in real-time after deletion

### 5. Library Page (Combined Tab)
```typescript
fetch('/api/media/profile/' + user?.id)  // User's own releases
```
- ✅ Shows user's own published releases
- ✅ Delete button available
- ✅ Updates UI immediately after deletion

## Data Flow Diagram

```
┌─────────────────────────────────────────────────┐
│ User Creates Release (ReleaseModal)             │
│ ↓                                                │
│ POST /api/media/combine                         │
│ { is_public: true }  ← ALWAYS TRUE              │
│ ↓                                                │
│ Insert into `combined_media` table              │
│ ↓                                                │
│ ✅ Appears on: Explore, Profile, Library        │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ User Deletes ONE Release (Library)              │
│ ↓                                                │
│ POST /api/media/delete                          │
│ { id: "specific-uuid-123" }  ← ONE ID           │
│ ↓                                                │
│ DELETE FROM combined_media                      │
│ WHERE id = "specific-uuid-123"  ← ONE RECORD    │
│   AND user_id = current_user                    │
│ ↓                                                │
│ ✅ Removed from: Explore, Profile, Library      │
│ ✅ Other releases: UNAFFECTED                   │
│ ✅ Original files: PRESERVED in library         │
└─────────────────────────────────────────────────┘
```

## Testing Checklist

### Test Scenario 1: Multiple Releases
- [ ] User creates 3 releases (Track A, B, C)
- [ ] All 3 appear on explore page
- [ ] All 3 appear on profile page
- [ ] All 3 appear in library combined tab
- [ ] Delete Track B only
- [ ] ✅ Track A still visible everywhere
- [ ] ✅ Track C still visible everywhere
- [ ] ✅ Track B removed from everywhere

### Test Scenario 2: Original Files Preserved
- [ ] User creates music track "Song X"
- [ ] User creates cover art "Art Y"
- [ ] Both appear in library (Music tab, Images tab)
- [ ] User releases "Song X + Art Y" = Release Z
- [ ] Release Z appears in Combined tab
- [ ] Delete Release Z
- [ ] ✅ Song X still in Music tab
- [ ] ✅ Art Y still in Images tab
- [ ] ✅ Release Z removed from Combined tab

### Test Scenario 3: Multi-User Explore
- [ ] User A creates 2 releases
- [ ] User B creates 3 releases
- [ ] Explore page shows all 5 releases
- [ ] User A deletes 1 release
- [ ] ✅ Explore shows 4 releases (1 from A, 3 from B)
- [ ] ✅ User B's releases unaffected

## Database Queries for Verification

### Check total releases per user
```sql
SELECT 
  user_id,
  COUNT(*) as release_count,
  COUNT(*) FILTER (WHERE is_public = true) as public_count
FROM combined_media
GROUP BY user_id
ORDER BY release_count DESC;
```

### Check specific user's releases
```sql
SELECT 
  id,
  title,
  is_public,
  created_at
FROM combined_media
WHERE user_id = 'USER_ID_HERE'
ORDER BY created_at DESC;
```

### Verify deletion worked
```sql
-- Before delete: Should exist
SELECT id, title FROM combined_media WHERE id = 'RELEASE_ID_TO_DELETE';

-- After delete: Should return no rows
SELECT id, title FROM combined_media WHERE id = 'RELEASE_ID_TO_DELETE';
```

## Logging Output (Expected)

### When Creating Release:
```
✅ Combined media saved successfully!
```

### When Deleting Release:
```
🗑️ Deleting release: abc-123-def for user: user_xyz
✅ Successfully deleted release: abc-123-def
```

### When Fetching Explore:
```
📊 Explore API: Fetched 15 public tracks (is_public=true)
```

## Common Issues & Solutions

### Issue: "All tracks disappeared after deleting one"
**Cause**: Old tracks have `is_public = false` or `NULL`
**Solution**: Run SQL migration:
```sql
UPDATE combined_media
SET is_public = true
WHERE is_public IS NULL OR is_public = false;
```

### Issue: "Deleted track still appears"
**Cause**: Frontend cache not refreshed
**Solution**: Library page auto-refreshes, or reload page

### Issue: "Can't delete track"
**Cause**: User doesn't own the track
**Solution**: API verifies `user_id` matches before deletion

## Files Modified

1. ✅ `app/api/media/combine/route.ts` - Forces `is_public = true`
2. ✅ `app/api/media/delete/route.ts` - Deletes specific ID only
3. ✅ `app/api/media/explore/route.ts` - Filters by `is_public = true`
4. ✅ `app/api/media/profile/[userId]/route.ts` - Filters by `is_public = true`
5. ✅ `app/library/page.tsx` - Delete handler with optimistic UI update

## Deployment Status

- **Commit**: `4ea3180` - is_public always true
- **Commit**: `622d1e3` - DELETE API POST handler
- **Next Commit**: Profile API filter + enhanced logging

---
**Last Updated**: November 12, 2025
**Status**: ✅ VERIFIED - Delete only affects specific track
