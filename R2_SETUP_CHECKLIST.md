# Cloudflare R2 Setup Checklist

## ✅ Already Completed
- [x] AWS SDK installed (`@aws-sdk/client-s3`)
- [x] R2 upload utility created (`lib/r2-upload.ts`)
- [x] Upload API converted to use R2 methods
- [x] Environment variables configured for audio bucket
- [x] audio-files bucket created with public URL

## 🔧 Steps You Need to Complete in Cloudflare Dashboard

### Step 1: Create Images Bucket

1. Go to **Cloudflare R2 Dashboard** → **R2 Object Storage**
2. Click **"Create bucket"**
3. Name: `images`
4. Location: (use same as audio-files bucket)
5. Click **"Create bucket"**
6. After creation, click on the bucket
7. Go to **Settings** tab
8. Under **Public access**, click **"Allow Access"**
9. Click **"Enable R2.dev subdomain"**
10. **COPY THE PUBLIC URL** (format: `https://pub-xxxxx.r2.dev`)

### Step 2: Create Videos Bucket

1. Click **"Create bucket"** again
2. Name: `videos`
3. Location: (use same as other buckets)
4. Click **"Create bucket"**
5. After creation, click on the bucket
6. Go to **Settings** tab
7. Under **Public access**, click **"Allow Access"**
8. Click **"Enable R2.dev subdomain"**
9. **COPY THE PUBLIC URL** (format: `https://pub-xxxxx.r2.dev`)

### Step 3: Update CORS Policies for ALL 3 Buckets

**You need to update CORS for:**
- `audio-files`
- `images`
- `videos`

**For EACH bucket:**

1. Click on the bucket name
2. Go to **Settings** tab
3. Scroll to **CORS policy**
4. Click **"Edit CORS policy"**
5. Replace with this configuration:

```json
[
  {
    "AllowedOrigins": [
      "https://your-production-domain.vercel.app",
      "http://localhost:3000"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE",
      "HEAD"
    ],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

6. **IMPORTANT:** Replace `your-production-domain.vercel.app` with your actual Vercel deployment URL
7. Click **"Save"**

### Step 4: Update .env.local

After you get the public URLs for images and videos buckets, update your `.env.local` file:

```bash
# Replace these placeholder URLs with the actual ones from step 1 & 2
NEXT_PUBLIC_R2_IMAGES_URL=https://pub-YOUR_IMAGES_BUCKET_ID.r2.dev
NEXT_PUBLIC_R2_VIDEOS_URL=https://pub-YOUR_VIDEOS_BUCKET_ID.r2.dev
```

### Step 5: Update Vercel Environment Variables

If deploying to production, add these to your Vercel project:

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add:
   - `R2_ENDPOINT` = `https://95945bf0209126d122b1f04463871ebf.r2.cloudflarestorage.com`
   - `R2_ACCESS_KEY_ID` = `ebd5955c120cfb69205ed5d76eb9d6f2`
   - `R2_SECRET_ACCESS_KEY` = (your secret key)
   - `NEXT_PUBLIC_R2_AUDIO_URL` = `https://pub-a528583bbeb546fd9bca0a699f40b406.r2.dev`
   - `NEXT_PUBLIC_R2_IMAGES_URL` = (from step 1)
   - `NEXT_PUBLIC_R2_VIDEOS_URL` = (from step 2)

## 📋 Current CORS Policy (NEEDS UPDATE)

Your current CORS policy only allows:
```json
{
  "AllowedOrigins": ["http://localhost:3000"],
  "AllowedMethods": ["GET"]
}
```

**Problems:**
- ❌ Only allows localhost (not production domain)
- ❌ Only allows GET (uploads need PUT, POST, DELETE)
- ❌ Missing AllowedHeaders and ExposeHeaders

**Solution:** Use the CORS policy from Step 3 above

## 🚀 After Setup is Complete

### Test Upload Functionality

1. Build the project:
```bash
npm run build
```

2. Start dev server:
```bash
npm run dev
```

3. Test each upload type:
   - Music + Image upload
   - Standalone image upload
   - Video upload

4. Verify files appear in R2 buckets
5. Check profile grid displays all content types
6. Verify public URLs work

### Deploy to Production

1. Push code to repository:
```bash
git add .
git commit -m "Convert upload system to Cloudflare R2"
git push
```

2. Vercel will automatically deploy
3. Test uploads on production site

## 📝 Summary of Changes Made

### New Files Created:
- `lib/r2-upload.ts` - R2 upload utility using AWS SDK
- `R2_SETUP_CHECKLIST.md` - This guide

### Files Modified:
- `app/api/profile/upload/route.ts` - Converted from Supabase Storage to R2
- `.env.local` - Added R2 bucket URL placeholders

### What Changed in Upload API:

**Before (Supabase Storage):**
```typescript
const { error } = await supabase.storage
  .from('audio-files')
  .upload(fileName, buffer)
```

**After (Cloudflare R2):**
```typescript
const audioUpload = await uploadToR2(audioFile, 'audio-files', audioKey)
```

## ⚠️ Important Notes

1. **Public URLs:** Each bucket needs "Enable R2.dev subdomain" turned on
2. **CORS:** All 3 buckets need the updated CORS policy with your production domain
3. **Environment Variables:** Update both `.env.local` (local dev) and Vercel (production)
4. **Testing:** Test all 3 upload types before considering complete

## 🔗 Quick Links

- Cloudflare R2 Dashboard: https://dash.cloudflare.com/
- Your Account ID: `95945bf0209126d122b1f04463871ebf`
- Existing audio bucket: `https://pub-a528583bbeb546fd9bca0a699f40b406.r2.dev`

## ✨ Next Steps After This

Once uploads work:
1. Test metadata fields are saving correctly
2. Verify profile grid shows all media types with correct badges
3. Test video hover preview
4. Check public sharing URLs work
5. Consider adding file size limits if needed
