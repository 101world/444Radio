# Effects Not Saving - Database Migration Required

## Problem
Effects are not saving to library because the `combined_media` table schema requires `image_url NOT NULL`, but effects are audio-only content.

## Solution
Run the migration to add effects support.

## Steps to Fix

### 1. Go to Supabase Dashboard
1. Visit https://supabase.com/dashboard
2. Select your 444Radio project
3. Click **SQL Editor** in the left sidebar

### 2. Run the Migration
Copy and paste the entire contents of `db/migrations/007_add_effects_support.sql` into the SQL editor and click **Run**.

The migration will:
- ✅ Make `image_url` nullable (effects don't need images)
- ✅ Add `type` column (audio, video, effects, image)
- ✅ Add `prompt` column (for effects prompts)
- ✅ Add `genre` column (effects use 'effects' genre)
- ✅ Add `media_url` column (for future video support)
- ✅ Create indexes for performance

### 3. Verify
After running, you should see:
```
✅ Migration complete: Effects support added to combined_media
   - image_url is now nullable
   - Added columns: type, prompt, genre, media_url
   - Added indexes on type and genre
```

### 4. Test
1. Go to https://444radio.co.in/create
2. Click "Effects" button
3. Generate a sound effect (e.g., "dog barking")
4. Wait for generation to complete
5. Check your library - the effect should now appear!

## What This Fixes
- ✅ Effects can now save to database (image_url is optional)
- ✅ Effects show proper title: "SFX: dog barking..."
- ✅ Effects show proper subtitle: "dog barking and birds chirping"
- ✅ Library can filter by type and genre
- ✅ Future support for video-to-audio and other content types

## Migration File Location
`c:\444Radio\db\migrations\007_add_effects_support.sql`
