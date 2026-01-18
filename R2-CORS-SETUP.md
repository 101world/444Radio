# Cloudflare R2 CORS Configuration

## Problem
When uploading files directly from the browser to R2 using presigned URLs, you get:
```
Access to fetch at 'https://videos.xxx.r2.cloudflarestorage.com/...' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Solution
Configure CORS rules on your R2 buckets to allow cross-origin uploads from your domain.

## Steps

### 1. Go to Cloudflare R2 Dashboard
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2** in the sidebar
3. Click on your bucket (e.g., `videos`, `audio-files`)

### 2. Configure CORS Settings
Click on **Settings** tab → **CORS Policy** section

### 3. Add CORS Rule
Paste this JSON configuration:

```json
[
  {
    "AllowedOrigins": [
      "https://www.444radio.co.in",
      "https://444radio.co.in",
      "http://localhost:3000"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Type",
      "Content-Length"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

### 4. Apply to All Buckets
Repeat for each bucket:
- ✅ `videos`
- ✅ `audio-files`
- ✅ `images` (if you plan to upload images directly)

### 5. Save Changes
Click **Save** or **Update CORS Policy**

## Verify CORS is Working

### Test with curl:
```bash
# Test preflight request
curl -X OPTIONS https://videos.95945bf0209126d122b1f04463871ebf.r2.cloudflarestorage.com \
  -H "Origin: https://www.444radio.co.in" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

Should return:
```
< access-control-allow-origin: https://www.444radio.co.in
< access-control-allow-methods: GET, PUT, POST, DELETE, HEAD
< access-control-max-age: 3600
```

### Test in browser console:
```javascript
// After getting presigned URL, test upload
const testUpload = async () => {
  const response = await fetch('/api/upload/media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: 'test.mp4',
      fileType: 'video/mp4',
      fileSize: 1024
    })
  })
  const { uploadUrl } = await response.json()
  
  // Try PUT with small file
  const blob = new Blob(['test'], { type: 'video/mp4' })
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': 'video/mp4' }
  })
  
  console.log('Upload status:', uploadResponse.status) // Should be 200
}
```

## Important Notes

1. **Origin must match exactly**: Include both www and non-www versions
2. **AllowedHeaders: "*"**: Allows AWS signature headers (X-Amz-*)
3. **MaxAgeSeconds**: Browser caches preflight for 1 hour
4. **PUT method required**: Presigned URLs use PUT for uploads
5. **Apply to all buckets**: Each bucket has separate CORS config

## Troubleshooting

### Still getting CORS error after configuration?
1. **Wait 5 minutes**: CORS changes can take a few minutes to propagate
2. **Clear browser cache**: Hard refresh (Ctrl+Shift+R)
3. **Check origin**: Ensure your domain matches exactly (www vs non-www)
4. **Verify bucket name**: Make sure you configured the correct bucket

### CORS works but upload fails?
1. **Check presigned URL expiry**: Default is 10 minutes
2. **Verify Content-Type**: Must match what was signed
3. **File size**: Check R2 limits (5TB max per file)

## Alternative: Cloudflare CORS Proxy (if above doesn't work)

If you can't modify R2 CORS settings directly, add a Cloudflare Worker as a proxy:

```javascript
// Cloudflare Worker: r2-upload-proxy
export default {
  async fetch(request, env) {
    // Forward PUT requests to R2 with CORS headers
    const url = new URL(request.url)
    const r2Url = url.searchParams.get('url')
    
    const response = await fetch(r2Url, {
      method: request.method,
      body: request.body,
      headers: request.headers
    })
    
    return new Response(response.body, {
      status: response.status,
      headers: {
        ...response.headers,
        'Access-Control-Allow-Origin': 'https://www.444radio.co.in',
        'Access-Control-Allow-Methods': 'PUT, POST, GET',
        'Access-Control-Allow-Headers': '*'
      }
    })
  }
}
```

Then modify MediaUploadModal to use proxy:
```typescript
const proxyUrl = `/api/r2-proxy?url=${encodeURIComponent(uploadUrl)}`
await fetch(proxyUrl, { method: 'PUT', body: file })
```

## Production Checklist
- [ ] CORS configured on `videos` bucket
- [ ] CORS configured on `audio-files` bucket
- [ ] Tested video upload (5s video)
- [ ] Tested audio upload (30s audio)
- [ ] Verified public URLs are accessible
- [ ] Tested on production domain
- [ ] Tested on localhost (for dev)

## Security Notes
- **AllowedOrigins**: Only list your domains (never use `"*"` in production)
- **AllowedHeaders**: `"*"` is safe because AWS signature headers are required
- **No authentication bypass**: Presigned URLs already contain secure signatures
- **Expiry**: 10-minute expiry on presigned URLs prevents abuse

---

**Once CORS is configured, the upload flow will work:**
1. ✅ Client requests presigned URL from `/api/upload/media`
2. ✅ Client PUTs file directly to R2 (bypasses Vercel)
3. ✅ File accessible at public URL
4. ✅ Generation API uses public URL
