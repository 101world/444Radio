# Finding Your Missing 26 Songs

## Current Status
- **Database**: 14 unique songs across 3 tables (31 total rows with duplicates)
- **Expected**: 40 songs total
- **Missing**: 26 songs

## Most Likely Cause
Songs were generated successfully but **database write failed**. The audio files may still exist in your R2 bucket.

## How to Find Orphaned Files

### Option 1: Check R2 Bucket Directly
1. Go to Cloudflare Dashboard → R2 → `audio-files` bucket
2. Count total files in the bucket
3. Compare to database count (14 unique songs)
4. If bucket has 30-40 files → orphaned files exist!

### Option 2: Check R2 via API (Run this script)

Create a simple script to list all R2 audio files and compare with database:

```typescript
// scripts/find-orphaned-audio.ts
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
  }
})

async function listR2Files() {
  const command = new ListObjectsV2Command({
    Bucket: 'audio-files'
  })
  
  const response = await s3Client.send(command)
  console.log(`Total files in R2 bucket: ${response.Contents?.length || 0}`)
  
  // List all file URLs
  response.Contents?.forEach(file => {
    const publicUrl = `https://audio.444radio.co.in/${file.Key}`
    console.log(publicUrl)
  })
}

listR2Files()
```

### Option 3: Check Generation History in Browser Console

When you generate music, does the console show success messages? Check:
1. Browser DevTools → Console tab
2. Look for generation responses
3. Check if any show "Generation complete" but no database save confirmation

## Recovery Options

### If orphaned files exist in R2:

**Option A: Re-insert database records** (Recommended)
- Create a script to scan R2 bucket
- For each orphaned file, create a database record
- Requires knowing: title, prompt, created_at (can extract from filename if dated)

**Option B: Check generation logs**
- Look at Vercel deployment logs
- Search for failed database inserts around generation times
- May show error messages explaining why saves failed

**Option C: Check Replicate generation history**
- Go to replicate.com → Your predictions
- See all 40 generations with their output URLs
- Compare Replicate output URLs to database audio_urls
- Missing URLs = failed database saves

## Prevention Going Forward

Add retry logic to generation endpoints:

```typescript
// In app/api/generate/music/route.ts
try {
  // Upload to R2
  const audioUrl = await uploadToR2(...)
  
  // Try database save with retry
  let retries = 3
  while (retries > 0) {
    try {
      await supabase.from('music_library').insert({...})
      break // Success!
    } catch (dbError) {
      retries--
      if (retries === 0) throw dbError
      await new Promise(r => setTimeout(r, 1000)) // Wait 1s
    }
  }
} catch (error) {
  // Log to Sentry + alert user
}
```

## Next Steps

1. **Check R2 bucket file count** (Cloudflare dashboard)
2. **Check Replicate generation history** (replicate.com)
3. **Compare counts** to confirm orphaned files exist
4. **Decide on recovery strategy**

If you want me to create a recovery script to re-insert database records for orphaned files, let me know!
