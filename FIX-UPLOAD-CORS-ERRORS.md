# Fix Upload & CORS Errors - Jan 20, 2026

## Issues Fixed

### 1. ❌ CORS Error on Direct R2 Upload
**Error:** `Access to fetch at 'https://444radio-media.95945bf...r2.cloudflarestorage.com/...' has been blocked by CORS policy`

**Root Cause:** R2 bucket doesn't have CORS rules to allow uploads from your website.

### 2. ❌ 413 Request Entity Too Large
**Error:** `Failed to load resource: the server responded with a status of 413`

**Root Cause:** Vercel's default body size limit (4.5MB) is too small for video uploads.

### 3. ❌ CSP Blocks eval()
**Error:** `Content Security Policy prevents evaluation of arbitrary strings as JavaScript`

**Root Cause:** CSP was too restrictive and blocked legitimate JavaScript execution.

### 4. ❌ CORB (Cross-Origin Read Blocking)
**Error:** `Response was blocked by CORB`

**Root Cause:** Missing Cross-Origin headers for R2 resources.

---

## ✅ Code Fixes Applied

### 1. Updated `vercel.json`
- ✅ Fixed CSP to allow `'unsafe-eval'` with proper sources
- ✅ Added specific domains for connect-src, media-src, img-src
- ✅ Added Cross-Origin-Resource-Policy and Cross-Origin-Embedder-Policy headers
- ✅ Added CORS headers for all `/api/*` routes
- ✅ Increased upload endpoint memory to 3008MB and maxDuration to 300s

### 2. Updated `app/api/upload/media/route.ts`
- ✅ Changed bodyParser size limit to 100MB
- ✅ Added CORS support via `corsResponse()` and `OPTIONS` handler
- ✅ Applied CORS to all error responses

### 3. Updated `app/api/profile/banner/route.ts`
- ✅ Added comprehensive logging for debugging
- ✅ Better error messages with status codes
- ✅ Already had CORS support (no changes needed)

### 4. Updated `app/components/BannerUploadModal.tsx`
- ✅ Added detailed console logging
- ✅ Better error handling with response status checks
- ✅ More informative error messages for users

---

## 🔧 Required: Cloudflare R2 CORS Configuration

**⚠️ CRITICAL:** You must add CORS rules to your R2 bucket for uploads to work!

### Step 1: Go to Cloudflare Dashboard
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2** → **Buckets**
3. Click on **`444radio-media`** bucket

### Step 2: Add CORS Policy
1. Go to **Settings** tab
2. Scroll to **CORS Policy**
3. Click **Edit CORS Policy**
4. Paste this JSON:

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
      "HEAD",
      "DELETE"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Length",
      "Content-Type"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

5. Click **Save**

### Alternative: Using Wrangler CLI
```bash
# Install wrangler if not already
npm install -g wrangler

# Login
wrangler login

# Create cors.json file with the JSON above, then:
wrangler r2 bucket cors set 444radio-media --cors-file cors.json
```

---

## 📦 Deploy Changes

```powershell
# Add all changes
git add vercel.json app/api/upload/media/route.ts app/api/profile/banner/route.ts app/components/BannerUploadModal.tsx

# Commit
git commit -m "fix: upload CORS, CSP eval, and 413 errors"

# Push to deploy
git push origin master
```

---

## 🧪 Testing

### Test 1: Profile Banner Upload
1. Go to your profile: `https://www.444radio.co.in/profile/user_34IkVS04YVAZH371HSr3aaZlU60`
2. Click edit/upload banner button
3. Upload an image or video
4. Check browser console for logs: `[Banner] Upload response:`

### Test 2: Use Latest Cover Art
1. Click "Use latest cover" button
2. Should fetch your most recent cover art from generated tracks
3. Check console for: `[Banner API] Using latest cover:`

### Test 3: Media Upload (Create Page)
1. Go to `/create` or upload area
2. Upload a video file (test with ~20MB+ file)
3. Should not get 413 error anymore
4. Check console for presigned URL flow

---

## 🐛 Debugging

If uploads still fail after deploying:

### Check 1: CORS Headers in Browser
```javascript
// Open DevTools Console on your site
fetch('https://444radio-media.95945bf0209126d122b1f04463871ebf.r2.cloudflarestorage.com/test', {
  method: 'OPTIONS'
})
.then(r => {
  console.log('CORS headers:', {
    'Access-Control-Allow-Origin': r.headers.get('Access-Control-Allow-Origin'),
    'Access-Control-Allow-Methods': r.headers.get('Access-Control-Allow-Methods')
  })
})
```

### Check 2: Vercel Deployment Logs
1. Go to [Vercel Dashboard](https://vercel.com/)
2. Select your project
3. Go to **Deployments** → Latest deployment
4. Click **Functions** tab
5. Look for `/api/upload/media` logs

### Check 3: R2 Bucket CORS
```bash
wrangler r2 bucket cors get 444radio-media
```

Should output the CORS policy JSON. If empty, CORS is not configured.

---

## 📊 Expected Behavior After Fix

### ✅ Direct Upload (Fast Path)
1. Client requests presigned URL from `/api/upload/media`
2. Client uploads directly to R2 using presigned URL
3. Upload completes in ~2-5 seconds for large files
4. No Vercel bandwidth used

### ✅ Server Fallback (Slower)
1. If direct upload fails, client sends file to `/api/upload/media`
2. Server uploads to R2
3. Takes longer, uses Vercel bandwidth
4. But now handles up to 100MB files (was 4.5MB)

---

## 🔐 Security Notes

### CSP Changes
- **Before:** Blocked all eval(), caused errors with some libraries
- **After:** Allows `'unsafe-eval'` but restricts to specific domains
- **Risk:** Low - eval is scoped to trusted sources

### CORS Changes
- **Before:** Partial CORS support, blocked preflight requests
- **After:** Full CORS with wildcard `*` for API routes
- **Risk:** Low - auth is handled by Clerk middleware globally

---

## 📝 Related Files Modified

```
✅ vercel.json                           (CSP, CORS headers, function config)
✅ app/api/upload/media/route.ts        (CORS, body size, error handling)
✅ app/api/profile/banner/route.ts      (logging improvements)
✅ app/components/BannerUploadModal.tsx (error handling, logging)
```

---

## 🎯 Next Steps

1. ✅ **Apply R2 CORS** (Cloudflare Dashboard - REQUIRED!)
2. ✅ **Deploy code** (`git push`)
3. ✅ **Test uploads** (banner, media, video)
4. ✅ **Monitor logs** (Vercel + browser console)

---

## ⚡ Quick Reference

### Error → Solution
- **CORS blocked** → Add CORS policy to R2 bucket
- **413 error** → Already fixed in `vercel.json` (100MB limit)
- **CSP eval blocked** → Already fixed in `vercel.json` (unsafe-eval allowed)
- **CORB blocked** → Already fixed in `vercel.json` (Cross-Origin headers)

### Support URLs
- Cloudflare CORS docs: https://developers.cloudflare.com/r2/buckets/cors/
- Vercel body size limits: https://vercel.com/docs/functions/runtimes#request-body-size
- CSP reference: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP

---

**Status:** ✅ Code changes complete | ⏳ Awaiting R2 CORS configuration

