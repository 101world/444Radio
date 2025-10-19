# Database Migration Guide

## Apply Combined Media Table Migration

### Option 1: Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard
2. Select your project: **444radio**
3. Click **SQL Editor** in the left sidebar
4. Click **New query**
5. Copy and paste the entire content from:
   `supabase/migrations/20251019222839_add_combined_media_table.sql`
6. Click **Run** button
7. Verify success message

### Option 2: Supabase CLI

```bash
# Make sure you're in the project directory
cd c:\444Radio

# Link to your Supabase project (if not already linked)
npx supabase link --project-ref YOUR_PROJECT_REF

# Run the migration
npx supabase db push
```

### Option 3: Direct SQL Execution

Connect to your Supabase database using psql or any PostgreSQL client and run the migration file.

## Verification

After running the migration, verify in Supabase Dashboard:

1. Go to **Table Editor**
2. Look for `combined_media` table
3. Check that these columns exist:
   - id (uuid)
   - user_id (text)
   - audio_url (text)
   - image_url (text)
   - title (text)
   - audio_prompt (text)
   - image_prompt (text)
   - is_public (boolean)
   - likes (integer)
   - plays (integer)
   - created_at (timestamp)
   - updated_at (timestamp)

4. Go to **Authentication** → **Policies**
5. Verify RLS policies are created for `combined_media` table

## What This Migration Does

- ✅ Creates `combined_media` table with all necessary columns
- ✅ Adds indexes for performance (user_id, created_at, is_public)
- ✅ Enables Row Level Security (RLS)
- ✅ Creates policies:
  - Users can view their own combined media
  - Anyone can view public combined media
  - Users can insert/update/delete their own combined media

## After Migration

The following features will work:

1. **Combine Media** - Save audio + image combinations to database
2. **Explore Page** - Display public combined media from all users
3. **Profile Pages** - Show user's combined media
4. **CombinedMediaPlayer** - Play audio with image thumbnails
5. **Social Features** - Likes, plays tracking ready

## Testing

1. Visit https://444radio.co.in
2. Generate music + cover art
3. Click "Combine Media"
4. Select 1 audio + 1 image
5. Click "Save to Profile"
6. Visit /explore to see your creation!
