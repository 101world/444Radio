# Storage Buckets Setup Guide for 444 Radio

## ✅ What We've Completed:

1. **Database Tables Created** (SQL ran successfully ✓)
   - `profile_media` table for standalone images/videos
   - `combined_media` table updated with metadata fields

2. **Features Implemented:**
   - Profile upload system (Music+Image, Image, Video)
   - Metadata collection (genre, mood, BPM, copyright, license, price)
   - Type badges on thumbnails
   - 3D Blackhole background on main page
   - Clean explore page with simple search

---

## 🗄️ STORAGE BUCKETS TO CREATE

You need to create 3 storage buckets in Supabase:

### **Go to Supabase Dashboard:**
1. Open your project: https://supabase.com/dashboard/project/YOUR_PROJECT
2. Click **Storage** in the left sidebar
3. Click **"New bucket"** button

---

### **Bucket 1: `audio-files`**

**Settings:**
- **Name:** `audio-files`
- **Public bucket:** ✅ **YES** (check the box)
- **File size limit:** 50 MB
- **Allowed MIME types:** 
  ```
  audio/mpeg
  audio/mp3
  audio/wav
  audio/ogg
  audio/aac
  audio/flac
  ```

**RLS Policies (After creating bucket):**
1. Click on the `audio-files` bucket
2. Go to **"Policies"** tab
3. Click **"New policy"**
4. **Policy 1 - Public Read Access:**
   - Name: `Public audio files are accessible`
   - Operation: `SELECT`
   - Policy definition:
     ```sql
     true
     ```

5. **Policy 2 - Authenticated Upload:**
   - Name: `Users can upload their own audio`
   - Operation: `INSERT`
   - Policy definition:
     ```sql
     (bucket_id = 'audio-files'::text) AND (auth.uid() IS NOT NULL)
     ```

---

### **Bucket 2: `images`**

**Settings:**
- **Name:** `images`
- **Public bucket:** ✅ **YES** (check the box)
- **File size limit:** 10 MB
- **Allowed MIME types:**
  ```
  image/jpeg
  image/jpg
  image/png
  image/webp
  image/gif
  ```

**RLS Policies:**
1. **Policy 1 - Public Read Access:**
   - Name: `Public images are accessible`
   - Operation: `SELECT`
   - Policy definition:
     ```sql
     true
     ```

2. **Policy 2 - Authenticated Upload:**
   - Name: `Users can upload their own images`
   - Operation: `INSERT`
   - Policy definition:
     ```sql
     (bucket_id = 'images'::text) AND (auth.uid() IS NOT NULL)
     ```

---

### **Bucket 3: `videos`**

**Settings:**
- **Name:** `videos`
- **Public bucket:** ✅ **YES** (check the box)
- **File size limit:** 100 MB
- **Allowed MIME types:**
  ```
  video/mp4
  video/mpeg
  video/quicktime
  video/webm
  video/ogg
  video/x-msvideo
  ```

**RLS Policies:**
1. **Policy 1 - Public Read Access:**
   - Name: `Public videos are accessible`
   - Operation: `SELECT`
   - Policy definition:
     ```sql
     true
     ```

2. **Policy 2 - Authenticated Upload:**
   - Name: `Users can upload their own videos`
   - Operation: `INSERT`
   - Policy definition:
     ```sql
     (bucket_id = 'videos'::text) AND (auth.uid() IS NOT NULL)
     ```

---

## 📋 Quick Checklist:

- [ ] Create `audio-files` bucket (Public, 50MB limit)
- [ ] Add 2 policies to `audio-files` bucket
- [ ] Create `images` bucket (Public, 10MB limit)
- [ ] Add 2 policies to `images` bucket
- [ ] Create `videos` bucket (Public, 100MB limit)
- [ ] Add 2 policies to `videos` bucket

---

## 🎯 What Your Profile Can Now Do:

### **Upload Options:**
1. **🎵 Music + Image** (Combined Track)
   - Upload audio file (.mp3, .wav, etc.)
   - Upload cover art (.jpg, .png, etc.)
   - Add metadata (genre, mood, BPM, key)
   - Set copyright owner & license type
   - Optional price for monetization
   - Saves to `combined_media` table

2. **🖼️ Standalone Image**
   - Upload image file
   - Saves to `profile_media` table
   - Shows as "Image" badge in profile grid

3. **🎬 Video**
   - Upload video file (.mp4, .webm, etc.)
   - Auto-plays preview on hover in grid
   - Saves to `profile_media` table
   - Shows as "Video" badge in profile grid

4. **AI Generated Content**
   - Any AI-generated cover art from your library
   - Can be saved as standalone image
   - All previous combined tracks still work

### **Profile Grid Display:**
- 2-6 column responsive grid
- Type badges: **Track** | **Image** | **Video**
- Published status badge
- Glassmorphism cards with hover effects
- Videos play preview on hover
- All content chronologically sorted

---

## 🚀 Testing After Setup:

1. Go to your profile page
2. Click the **Upload** icon (next to your username in badge)
3. Select content type (Music+Image / Image / Video)
4. Fill in title
5. Select file(s)
6. Upload!
7. See it appear in your profile grid with proper badge

---

## 💡 Features Summary:

✅ **Explore Page:**
- Clean, minimal design
- Simple search bar with "Send" button
- No header text
- No bottom category tabs
- Just music grid + player

✅ **Main Page:**
- 3D pixel dust particles
- Infinite blackhole gravity effect
- Purple/blue particle glow
- Particles spiral into center

✅ **Profile Page:**
- Upload 3 types of content
- Metadata collection
- Copyright protection
- Monetization ready (price field)
- Type-specific badges
- Video preview on hover

---

## 📝 Notes:

- All buckets **MUST** be public for URLs to work
- File size limits can be adjusted based on your needs
- MIME types list can be expanded if needed
- RLS policies ensure only authenticated users can upload
- Everyone can view/download from public URLs
