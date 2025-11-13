# Library Data Sources - Complete Reference

## User: 101world
**Clerk User ID:** `user_34J8MP3KCfczODGn9yKMolWPX9R`

## Database Tables & ID Columns

### 1. `combined_media` 
- **ID Column:** `user_id` 
- **Content:** Audio + Images combined
- **Query:** `WHERE user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'`

### 2. `combined_media_library`
- **ID Column:** `clerk_user_id`
- **Content:** Unpublished library items (audio + images)
- **Query:** `WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'`

### 3. `music_library`
- **ID Column:** `clerk_user_id`
- **Content:** Audio files only
- **Query:** `WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'`

### 4. `images_library`
- **ID Column:** `clerk_user_id`
- **Content:** Image files only
- **Query:** `WHERE clerk_user_id = 'user_34J8MP3KCfczODGn9yKMolWPX9R'`

## API Endpoints (Updated)

### `/api/library/music`
**Now queries ALL 3 music sources:**
1. `combined_media` (user_id)
2. `combined_media_library` (clerk_user_id)
3. `music_library` (clerk_user_id)

**Deduplication:** By `audio_url` (keeps earliest created_at)

### `/api/library/images`
**Queries 2 image sources:**
1. `images_library` (clerk_user_id)
2. `combined_media` (user_id, where image_url exists)

**Deduplication:** By `image_url`

### `/api/library/releases`
**Queries published items from 2 sources:**
1. `combined_media` (user_id, where is_published=true)
2. `combined_media_library` (clerk_user_id, where is_published=true)

**Deduplication:** By `audio_url`

### `/api/library/likes`
**Placeholder:** Returns empty array (likes feature not yet implemented)

## SQL Files Created

1. **`COMPLETE_LIBRARY_CHECK.sql`** ⭐ **START HERE**
   - Comprehensive check showing exactly what library page will display
   - Breakdown by table
   - Deduplicated list of all tracks
   - Duplicate detection
   - Summary by tab

2. **`QUICK_FIND_ALL_TRACKS.sql`**
   - Simple query to see all tracks
   - Get total count

3. **`FIND_ALL_101WORLD_TRACKS.sql`**
   - Detailed analysis with CTEs
   - Multiple views of the data
   - Duplicate finding

4. **`VERIFY_LIBRARY_API_DATA.sql`**
   - Verify what each API endpoint should return
   - Check for tracks missing from certain tables
   - Sample data from each source

## Expected Results (After Update)

### Before Fix:
- combined_media: 12 songs
- combined_media_library: 8 songs (NOT being queried)
- music_library: ? songs (NOT being queried)
- **Total showing:** 12 songs

### After Fix:
- combined_media: 12 songs ✅
- combined_media_library: 8 songs ✅ NOW INCLUDED
- music_library: ? songs ✅ NOW INCLUDED
- **Total showing:** All unique songs from ALL tables

## How to Verify

1. **Run `COMPLETE_LIBRARY_CHECK.sql` in Supabase:**
   - See total unique track count
   - See breakdown by table
   - See all tracks deduplicated
   - See which tracks appear in multiple tables

2. **Check live library page:**
   - Go to https://444radio.co.in/library
   - Music tab count should match SQL query result
   - All tracks from day 1 should be visible

3. **Console logs:**
   - Open browser DevTools → Console
   - Look for: `✅ Loaded X music items`
   - Should show combined count from all 3 tables

## Deduplication Logic

Same track may exist in multiple tables → We show it once:
- **Rule:** Keep the version with earliest `created_at`
- **Key:** Deduplicate by `audio_url` (unique identifier)

Example:
- Track exists in `combined_media` (created 2024-01-01)
- Same track in `music_library` (created 2024-01-02)
- **Result:** Show only the combined_media version (older)

## Migration Notes

If you generated 40+ songs historically but only see 12-20:
- They may have been generated but **not saved to database**
- Generation API succeeded, but DB write failed
- No way to recover unless R2 bucket still has the files

To check R2 bucket for orphaned files:
- Count files in R2 bucket vs database entries
- If R2 has more files → those are orphaned generations
