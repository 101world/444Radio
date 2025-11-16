# R2 Storage Setup Guide

## Current Status
✅ R2 credentials configured in `.env.local`  
⚠️ Need to verify Vercel environment variables

## Environment Variables Required

### Cloudflare R2 Configuration
```env
R2_ACCOUNT_ID=95945bf0209126d122b1f04463871ebf
R2_ENDPOINT=https://95945bf0209126d122b1f04463871ebf.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=4c02d4ab71ac05efbf7e8c01b8bcc1eb
R2_SECRET_ACCESS_KEY=e57ed23cb9c29a7cfc3a0359c7f38ac49edd5e761c6737bf93400fb3aad25109
R2_BUCKET_NAME=444radio-media
R2_PUBLIC_URL=https://pub-e5b60d303c5547e891ae88829c469ed6.r2.dev

# Public URLs (all pointing to same bucket)
NEXT_PUBLIC_R2_AUDIO_URL=https://pub-e5b60d303c5547e891ae88829c469ed6.r2.dev
NEXT_PUBLIC_R2_IMAGES_URL=https://pub-e5b60d303c5547e891ae88829c469ed6.r2.dev
NEXT_PUBLIC_R2_VIDEOS_URL=https://pub-e5b60d303c5547e891ae88829c469ed6.r2.dev
```

## Vercel Setup Steps

### 1. Add Environment Variables to Vercel

Go to your Vercel project settings:
1. Navigate to: https://vercel.com/101world/444radio/settings/environment-variables
2. Add each variable above
3. Select all environments: Production, Preview, Development

### 2. Quick Setup Script

Run this in PowerShell to verify local setup:

```powershell
# Test R2 connection locally
npm run dev
# Then visit: http://localhost:3000/api/r2/test-connection
```

### 3. Deploy to Vercel

```powershell
git add -A
git commit -m "Enable R2 storage connection"
git push
```

### 4. Verify in Production

After deployment, test these endpoints:
- https://www.444radio.co.in/api/r2/test-connection
- https://www.444radio.co.in/api/r2/list-audio
- https://www.444radio.co.in/api/r2/list-images

## Expected Responses

### Successful Connection
```json
{
  "success": true,
  "message": "R2 connection successful",
  "config": {
    "endpoint": "https://95945bf0209126d122b1f04463871ebf.r2.cloudflarestorage.com",
    "bucketName": "444radio-media"
  },
  "objectCount": 0
}
```

### Failed Connection
```json
{
  "success": false,
  "error": "R2 credentials not configured"
}
```

## Troubleshooting

### Issue: "R2 credentials not configured"
- Verify all R2_* variables are set in Vercel
- Check for typos in variable names
- Redeploy after adding variables

### Issue: "Failed to access R2 bucket"
- Verify bucket name is correct: `444radio-media`
- Check R2 access key has proper permissions
- Ensure bucket exists in Cloudflare R2 dashboard

### Issue: Files not showing in Library
- Check `/api/r2/test-connection` returns success
- Verify public URL is accessible
- Check bucket has public access enabled for reads

## R2 Bucket Structure

```
444radio-media/
├── users/
│   └── {userId}/
│       ├── music/
│       │   └── *.mp3
│       ├── images/
│       │   └── *.png, *.jpg
│       └── videos/
│           └── *.mp4
└── public/
    └── (shared assets)
```

## Making Bucket Public (Cloudflare Dashboard)

1. Go to: https://dash.cloudflare.com/
2. Select R2
3. Click on `444radio-media` bucket
4. Go to Settings tab
5. Under "Public Access", click "Allow Access"
6. Copy the public URL (should match R2_PUBLIC_URL)

## Next Steps After Setup

1. ✅ Test connection: `/api/r2/test-connection`
2. ✅ Upload test file via Library or Studio
3. ✅ Verify file appears in Library
4. ✅ Test playback/download

## Integration Points

### Where R2 is Used:
- **Library Page**: Lists and displays R2 content
- **Profile Upload**: Saves audio to R2
- **Studio Multi-track**: Optionally uploads stems to R2
- **Generation**: Can save AI-generated content to R2

### API Endpoints:
- `POST /api/profile/upload` - Upload audio files
- `GET /api/r2/list-audio` - List user's audio files
- `GET /api/r2/list-images` - List user's images
- `GET /api/r2/test-connection` - Test R2 connection
- `POST /api/r2/proxy` - Proxy R2 files (if needed)
