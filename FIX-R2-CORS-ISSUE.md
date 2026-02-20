# Fix R2 CORS Issue for media.444radio.co.in

## Problem
```
Access to audio at 'https://media.444radio.co.in/user_39qZno2Kce4PEd5aT1zWY4cR1bS/effects-1771624296808.mp3' 
from origin 'https://www.444radio.co.in' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Root Cause
- `AudioPlayerContext.tsx` treats `media.444radio.co.in` as a CDN and plays audio directly
- R2 bucket behind `media.444radio.co.in` doesn't have CORS headers configured
- Browser blocks cross-origin audio requests without proper CORS headers

## Solution 1: Configure CORS on R2 Bucket (RECOMMENDED)

### Step 1: Log in to Cloudflare Dashboard
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2** in sidebar
3. Find the bucket that's mapped to `media.444radio.co.in` (likely `444radio-media` or similar)

### Step 2: Add CORS Policy
1. Click on the bucket name
2. Go to **Settings** tab
3. Scroll to **CORS Policy** section
4. Click **Add CORS Policy** or **Edit**

### Step 3: Paste This Configuration
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
      "HEAD",
      "OPTIONS"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "Content-Type",
      "Content-Length",
      "Accept-Ranges",
      "Content-Range"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

### Step 4: Save and Wait
- Click **Save**
- Wait 2-5 minutes for changes to propagate
- Hard refresh your browser (Ctrl+Shift+R)

### Step 5: Verify
Open browser console and run:
```javascript
fetch('https://media.444radio.co.in/user_39qZno2Kce4PEd5aT1zWY4cR1bS/effects-1771624296808.mp3', {
  method: 'HEAD'
}).then(r => console.log('CORS headers:', r.headers.get('access-control-allow-origin')))
```

Should return: `https://www.444radio.co.in` or `*`

---

## Solution 2: Force Proxy for All R2 URLs (Quick Fix)

If you can't access Cloudflare dashboard right now, force all R2 URLs through the proxy:

### Edit AudioPlayerContext.tsx
Remove `media.444radio.co.in` from the CDN whitelist so it gets proxied:

```typescript
// File: app/contexts/AudioPlayerContext.tsx
// Around line 68-69

function computeUrl(u: string): string {
  try {
    if (u.startsWith('blob:') || u.startsWith('/')) return u
    const target = new URL(u)
    const r2CustomHosts: string[] = []
    if (process.env.NEXT_PUBLIC_R2_AUDIO_URL) r2CustomHosts.push(new URL(process.env.NEXT_PUBLIC_R2_AUDIO_URL).hostname)
    if (process.env.NEXT_PUBLIC_R2_IMAGES_URL) r2CustomHosts.push(new URL(process.env.NEXT_PUBLIC_R2_IMAGES_URL).hostname)
    if (process.env.NEXT_PUBLIC_R2_VIDEOS_URL) r2CustomHosts.push(new URL(process.env.NEXT_PUBLIC_R2_VIDEOS_URL).hostname)
    // Also recognize the unified R2_PUBLIC_URL (media.444radio.co.in) as a CDN host
    if (process.env.NEXT_PUBLIC_R2_PUBLIC_URL) r2CustomHosts.push(new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_URL).hostname)
    
    // ❌ REMOVE THIS LINE - it's causing direct playback without CORS:
    // r2CustomHosts.push('media.444radio.co.in')
    
    if (r2CustomHosts.includes(target.hostname)) return u // CDN — play direct
    const isRawR2 = target.hostname.endsWith('.r2.dev') || target.hostname.endsWith('.r2.cloudflarestorage.com')
    const isReplicate = target.hostname.includes('replicate.delivery') || target.hostname.includes('replicate.com')
    
    // ✅ ADD: Force media.444radio.co.in through proxy
    const isMediaDomain = target.hostname === 'media.444radio.co.in'
    
    return (isRawR2 || isReplicate || isMediaDomain) ? `/api/r2/proxy?url=${encodeURIComponent(u)}` : u
  } catch { return u }
}
```

**Tradeoff**: This adds latency (proxy routing) but works immediately without Cloudflare access.

---

## Which Solution to Choose?

| Solution | Pros | Cons | Use When |
|----------|------|------|----------|
| **1. R2 CORS Config** | ✅ Direct playback (fastest)<br>✅ Proper solution<br>✅ Lower server load | ❌ Requires Cloudflare access<br>❌ 5-min propagation | You have Cloudflare access |
| **2. Force Proxy** | ✅ Works immediately<br>✅ No Cloudflare access needed | ❌ Adds latency<br>❌ Higher server load<br>❌ Temporary workaround | Quick emergency fix |

**Recommendation**: Do **Solution 1** (CORS config) for production. Use **Solution 2** only as a temporary workaround.

---

## Testing After Fix

### Test 1: Direct Playback
1. Go to https://www.444radio.co.in/radio
2. Click play on any audio track
3. Check browser console - should see no CORS errors
4. Audio should play smoothly

### Test 2: Effects Playback
1. Go to your Library or Profile
2. Play the effects track that was failing:
   `effects-1771624296808.mp3`
3. Should play without errors

### Test 3: Network Tab
1. Open browser DevTools → Network tab
2. Play an audio track
3. Check the audio request:
   - **With Solution 1**: Direct request to `media.444radio.co.in` (status 200)
   - **With Solution 2**: Request to `/api/r2/proxy?url=...` (status 200)

---

## Prevention for Future

### When Adding New R2 Buckets
1. Always configure CORS policy immediately
2. Test with `curl -X OPTIONS` before deploying
3. Add all your domains to `AllowedOrigins`

### Environment Variables to Check
Ensure these are set:
```env
NEXT_PUBLIC_R2_AUDIO_URL=https://media.444radio.co.in
NEXT_PUBLIC_R2_IMAGES_URL=https://media.444radio.co.in
NEXT_PUBLIC_R2_VIDEOS_URL=https://media.444radio.co.in
```

If they all point to the same domain, make sure that ONE R2 bucket has proper CORS.

---

## Need Help?

If Solution 1 doesn't work after 5 minutes:
1. Check you saved the CORS policy
2. Verify bucket name matches the one serving `media.444radio.co.in`
3. Try Solution 2 as immediate workaround
4. Check Cloudflare DNS settings (CNAME should point to R2 bucket)

**Status**: Issue identified and solutions provided ✅
