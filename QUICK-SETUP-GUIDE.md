# 🚀 QUICK SETUP GUIDE - Copy & Paste Edition

## 📋 What Was Changed

### 1. Profile Page ✅
- **Added play counts and like counts** to all track displays
- Both desktop (4-column grid) and mobile (vertical list) layouts updated
- Shows: ▶️ plays | ❤️ likes next to each track

### 2. Database Schema ✅
- **Likes system** for combined_media table
- **Banner uploads** for user profiles
- All indexes and RLS policies configured

### 3. Multi-Language Music Generation ✅
- **English**: Uses MiniMax Music-1.5 (optimized)
- **All Other Languages**: Uses ACE-Step with advanced controls

---

## 🗄️ STEP 1: Run This in Supabase SQL Editor

Copy the entire contents of: **`SUPABASE-SETUP-ALL-AT-ONCE.sql`**

Or copy this directly:

```sql
BEGIN;

-- Add likes column to combined_media
ALTER TABLE combined_media 
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;

-- Create media_likes junction table
CREATE TABLE IF NOT EXISTS media_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  media_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, media_id),
  CONSTRAINT fk_media_likes_user FOREIGN KEY (user_id) 
    REFERENCES users(clerk_user_id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_media_likes_user ON media_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_media_likes_media ON media_likes(media_id);
CREATE INDEX IF NOT EXISTS idx_media_likes_created ON media_likes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_combined_media_likes ON combined_media(likes DESC);

-- RLS Policies
ALTER TABLE media_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view likes" ON media_likes;
DROP POLICY IF EXISTS "Users can create own likes" ON media_likes;
DROP POLICY IF EXISTS "Users can delete own likes" ON media_likes;

CREATE POLICY "Anyone can view likes" ON media_likes FOR SELECT USING (true);
CREATE POLICY "Users can create own likes" ON media_likes FOR INSERT 
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
CREATE POLICY "Users can delete own likes" ON media_likes FOR DELETE 
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Permissions
GRANT ALL ON media_likes TO service_role;
GRANT SELECT ON media_likes TO anon;
GRANT SELECT ON media_likes TO authenticated;

-- Add banner support
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS banner_url TEXT,
ADD COLUMN IF NOT EXISTS banner_type TEXT DEFAULT 'image';

CREATE INDEX IF NOT EXISTS idx_users_banner ON users(banner_url) WHERE banner_url IS NOT NULL;

COMMIT;
```

### ✅ Expected Output:
```
✅ likes column added to combined_media
✅ media_likes table created
✅ banner_url column added to users
```

---

## 🎵 STEP 2: Music Generation API Usage

### For English Music:
```typescript
const response = await fetch('/api/generate/music', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    songId: 'your-song-id',
    prompt: 'Your lyrics or prompt here',
    language: 'english',  // or 'en'
    params: {
      style_strength: 0.8  // 0.0 to 1.0
    }
  })
});
```

### For Non-English Music (Spanish, French, Chinese, etc.):
```typescript
const response = await fetch('/api/generate/music', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    songId: 'your-song-id',
    prompt: 'Your lyrics in any language',
    language: 'spanish',  // or 'chinese', 'french', 'german', 'japanese', 'korean', etc.
    params: {
      duration: 30,           // Duration in seconds
      quality: 50,            // 25 (fast) to 100 (high quality)
      adherence: 7.0,         // Prompt adherence: 1.0 to 20.0
      denoising_strength: 0.8,// 0.0 to 1.0
      seed: 123456           // Optional: for reproducibility
    }
  })
});
```

---

## 🎨 STEP 3: Profile Features Now Available

### View Play Counts & Likes
- Automatically displayed on profile pages
- Format: `▶️ 123` (plays) `❤️ 45` (likes)

### Like a Track (Frontend - TODO)
```typescript
// Example like button handler (needs API endpoint creation)
const handleLike = async (mediaId: string) => {
  await fetch('/api/media/like', {
    method: 'POST',
    body: JSON.stringify({ mediaId })
  });
};
```

### Upload Profile Banner (TODO - Task #3)
```typescript
// Example banner upload (needs implementation)
const handleBannerUpload = async (file: File, type: 'image' | 'video') => {
  // Upload to R2
  // Update users.banner_url and users.banner_type
};
```

---

## 📝 Remaining Tasks

1. **✅ DONE**: Database schema for likes & banners
2. **✅ DONE**: Profile UI shows play/like counts
3. **✅ DONE**: Multi-language music generation API
4. **🚧 TODO**: Add language selector dropdown to generation modal
5. **🚧 TODO**: Create banner upload feature in ProfileUploadModal
6. **🚧 TODO**: Add like button API endpoint (`/api/media/like`)
7. **🚧 TODO**: Build Studio page with audio editor

---

## 🔍 Verify Everything Works

### Test Database:
```sql
-- Check likes column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'combined_media' AND column_name = 'likes';

-- Check media_likes table exists
SELECT * FROM information_schema.tables WHERE table_name = 'media_likes';

-- Check banner columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name IN ('banner_url', 'banner_type');
```

### Test Music Generation:
1. Go to `/create` page
2. Enter a prompt with a non-English language
3. Pass `language` parameter in the request
4. Verify ACE-Step model is used for non-English

---

## 🆘 Troubleshooting

### If SQL fails:
- Make sure `combined_media` table exists
- Make sure `users` table has `clerk_user_id` column
- Check Supabase logs for specific errors

### If music generation fails:
- Verify `REPLICATE_API_TOKEN` is set in environment variables
- Check model version: `lucataco/ace-step:latest`
- Ensure prompt is in the correct language

---

## 🎉 Success Indicators

- ✅ Profile pages show play counts and like counts
- ✅ Database has `likes` column and `media_likes` table
- ✅ Users table has `banner_url` and `banner_type` columns
- ✅ English music uses MiniMax Music-1.5
- ✅ Non-English music uses ACE-Step model

---

**Ready to rock! 🚀**
