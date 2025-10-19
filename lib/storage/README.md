# R2 Storage Library - Usage Examples

## Installation Complete! ✅

The R2 storage library is ready to use. Here's how to integrate it:

---

## Basic Usage

### 1. Upload Generated Music to R2

```typescript
import { downloadAndUploadToR2 } from '@/lib/storage'

// After generating music with Replicate
const replicateUrl = "https://replicate.delivery/.../output.mp3"

// Upload to R2 (will be permanent)
const result = await downloadAndUploadToR2(
  replicateUrl,
  userId,
  'music',
  'my-track.mp3'
)

if (result.success) {
  console.log('Permanent URL:', result.url)
  // Save result.url to database instead of replicateUrl
}
```

### 2. Upload Generated Image to R2

```typescript
// After generating cover art
const replicateImageUrl = "https://replicate.delivery/.../output.webp"

const result = await downloadAndUploadToR2(
  replicateImageUrl,
  userId,
  'images',
  'cover-art.webp'
)

// Use result.url for permanent storage
```

### 3. List User's Files

```typescript
import { listUserFiles, getAllUserMedia } from '@/lib/storage'

// List music files only
const musicFiles = await listUserFiles(userId, 'music')

// List all media
const allMedia = await getAllUserMedia(userId)
console.log(allMedia.music)   // Array of music files
console.log(allMedia.images)  // Array of images
```

### 4. Delete Files

```typescript
import { deleteFromR2, deleteUserFolder } from '@/lib/storage'

// Delete single file
await deleteFromR2({ userId, key: 'users/abc/music/123.mp3' })

// Delete all music for user
await deleteUserFolder(userId, 'music')
```

---

## Integration with Existing Code

### Update `music-only/route.ts`

```typescript
import { downloadAndUploadToR2 } from '@/lib/storage'

// After Replicate generates music:
const output = await replicate.run("minimax/music-1.5", { input })
const replicateUrl = typeof output === 'string' ? output : output.url()

// Upload to R2 for permanent storage
const r2Result = await downloadAndUploadToR2(
  replicateUrl,
  userId,
  'music',
  `${prompt.slice(0, 30)}-${Date.now()}.mp3`
)

// Return permanent R2 URL instead of Replicate URL
return NextResponse.json({
  success: true,
  audioUrl: r2Result.url,  // ← Permanent URL!
  temporaryUrl: replicateUrl, // Keep for backup
  creditsRemaining: userCredits - 2
})
```

### Update `image-only/route.ts`

```typescript
import { downloadAndUploadToR2 } from '@/lib/storage'

// After Flux generates image:
const imageUrl = data.imageUrl

// Upload to R2
const r2Result = await downloadAndUploadToR2(
  imageUrl,
  userId,
  'images',
  `cover-${Date.now()}.webp`
)

return NextResponse.json({
  success: true,
  imageUrl: r2Result.url, // ← Permanent URL!
  creditsRemaining
})
```

---

## API Endpoints

### Upload via API
```typescript
// POST /api/storage/upload
const response = await fetch('/api/storage/upload', {
  method: 'POST',
  body: JSON.stringify({
    sourceUrl: 'https://replicate.delivery/.../file.mp3',
    folder: 'music',
    fileName: 'my-track.mp3'
  })
})

const data = await response.json()
// { success: true, url: "https://pub-xxx.r2.dev/users/.../file.mp3" }
```

### List Files via API
```typescript
// GET /api/storage/list?folder=music
const response = await fetch('/api/storage/list?folder=music')
const data = await response.json()
// { success: true, files: [...] }

// GET /api/storage/list (all folders)
const response = await fetch('/api/storage/list')
const data = await response.json()
// { success: true, media: { music: [...], images: [...] } }
```

---

## File Organization

Files are organized automatically:

```
r2://444radio-media/
  └── users/
      └── user_2abc123xyz/
          ├── music/
          │   ├── 1729425600000-upbeat-electronic.mp3
          │   └── 1729425700000-chill-lofi.mp3
          ├── images/
          │   ├── 1729425600000-neon-cover.webp
          │   └── 1729425700000-abstract-art.webp
          └── combined/
              └── 1729425800000-metadata.json
```

---

## Database Integration

Update your database to store R2 URLs:

### Combined Media Table
```sql
-- Before: Stores temporary Replicate URLs
audio_url TEXT  -- "https://replicate.delivery/.../temp.mp3"

-- After: Stores permanent R2 URLs
audio_url TEXT  -- "https://pub-xxx.r2.dev/users/abc/music/123.mp3"
```

### Migration Strategy
1. Generate with Replicate (temporary URL)
2. Upload to R2 (permanent URL)
3. Save R2 URL to database
4. Optionally keep Replicate URL as backup for 24 hours

---

## Environment Variables Required

```bash
# .env.local
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=444radio-media
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

---

## Benefits

### Before (Replicate URLs)
- ❌ URLs expire in 24-48 hours
- ❌ Can't share long-term
- ❌ No user organization
- ❌ Can't list user's files

### After (R2 Storage)
- ✅ Permanent URLs (never expire)
- ✅ Share forever
- ✅ Organized by user
- ✅ List all files per user
- ✅ Cheap ($0.015/GB/month)
- ✅ Free bandwidth
- ✅ Fast global CDN

---

## Cost Example

For 1000 active users:
- Each generates 10 tracks (~50MB) per month
- Storage: 1000 × 50MB = 50GB
- Cost: 50GB × $0.015 = **$0.75/month**
- Bandwidth: **$0.00** (unlimited free)

Total: **~$1/month** for 10,000 tracks!

---

## Next Steps

1. ✅ Library installed
2. ✅ API endpoints created
3. ⏳ Add R2 environment variables
4. ⏳ Update generation endpoints to use R2
5. ⏳ Test upload flow
6. ⏳ Update database to use permanent URLs

Ready to integrate! 🚀
