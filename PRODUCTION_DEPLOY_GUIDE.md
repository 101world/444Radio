# 444Radio - Production Deployment Guide

## Current Status
✅ Latest code pushed to GitHub (commit `936ecf0`)  
⏳ Waiting for Vercel to deploy automatically OR you trigger manual redeploy

---

## Step 1: Verify Vercel Auto-Deployment

1. Go to **https://vercel.com/dashboard**
2. Select your **444Radio** project
3. Click **Deployments** tab
4. Check if the latest deployment shows:
   - Commit: `936ecf0` - "Add /api/debug/deploy-info to verify production commit and env vars"
   - Status: **Ready** (green checkmark)
   - Domain: Your production URL (e.g., `444radio.co.in`)

**If the latest deployment is NOT showing or is still building:**
- Wait 1-2 minutes for auto-deploy to complete
- Or manually redeploy: Click "⋯" menu on the latest commit → **Redeploy**

---

## Step 2: Configure R2 Environment Variables (CRITICAL)

**In Vercel Dashboard:**

1. Project → **Settings** → **Environment Variables**
2. Add/Update these variables for **Production** environment:

```
R2_ENDPOINT
Value: https://95945bf0209126d122b1f04463871ebf.r2.cloudflarestorage.com

R2_ACCESS_KEY_ID
Value: ebd5955c120cfb69205ed5d76eb9d6f2

R2_SECRET_ACCESS_KEY
Value: e57ed23cb9c29a7cfc3a0359c7f38ac49edd5e761c6737bf93400fb3aad25109

R2_BUCKET_NAME
Value: 444radio-media

NEXT_PUBLIC_R2_AUDIO_URL
Value: https://pub-a528583bbeb546fd9bca0a699f40b406.r2.dev
```

3. **Save** each variable
4. After saving ALL variables, click **Redeploy** on the latest deployment

**Important Notes:**
- Variable names are **case-sensitive** (use UPPERCASE as shown)
- `NEXT_PUBLIC_*` vars must be set for them to work on client-side
- After adding env vars, you MUST redeploy for them to take effect

---

## Step 3: Verify Production is Live with Latest Code

### A) Check deployment info endpoint

Open in browser:
```
https://YOUR_DOMAIN/api/debug/deploy-info
```

Expected response:
```json
{
  "success": true,
  "git": {
    "sha": "936ecf0...",
    "branch": "master"
  },
  "r2": {
    "bucketName": "444radio-media",
    "hasAccessKey": true,
    "hasSecretKey": true,
    "endpointSet": true
  }
}
```

✅ If you see this with correct values → production is configured  
❌ If `r2.hasAccessKey` is false → env vars not set or redeploy needed

### B) Check R2 file listing endpoint

Open in browser:
```
https://YOUR_DOMAIN/api/r2/list-audio
```

Expected response:
```json
{
  "success": true,
  "bucketUsed": "444radio-media",
  "count": 40,
  "music": [...]
}
```

✅ If `count > 0` → R2 files found  
❌ If `count: 0` → Check bucket name or R2 token permissions

### C) Test Library Page

Open in browser:
```
https://YOUR_DOMAIN/library
```

**In browser console (F12)**, you should see:
```
✅ Loaded 0 from DB + 40 from R2 = 40 unique tracks
```

Replace `YOUR_DOMAIN` with your actual production domain (e.g., `444radio.co.in`)

---

## Troubleshooting

### Issue: /api/debug/deploy-info returns 404
- **Cause:** Deployment hasn't picked up latest commits
- **Fix:** Go to Vercel → Deployments → Manually **Redeploy** commit `936ecf0`

### Issue: /api/r2/list-audio returns count: 0
- **Cause:** Wrong bucket name or missing permissions
- **Fix:** 
  1. Verify `R2_BUCKET_NAME` in Vercel env matches your actual bucket
  2. Check R2 token has "Admin Read only" or "Object Read & Write" permissions
  3. Try `/api/r2/list-audio` response to see `bucketTried` array

### Issue: Library shows "0 from DB + 0 from R2"
- **Cause:** R2 env vars not set or redeploy needed
- **Fix:** 
  1. Double-check all 5 env vars are saved in Vercel
  2. Click **Redeploy** after saving env vars
  3. Wait 1-2 minutes for deploy to complete
  4. Hard refresh library page (Ctrl+Shift+R)

---

## Quick Verification Checklist

- [ ] Latest commit `936ecf0` deployed on Vercel (green checkmark)
- [ ] All 5 R2 env vars set in Vercel Production environment
- [ ] Redeployed after setting env vars
- [ ] `/api/debug/deploy-info` shows correct git SHA and r2 config
- [ ] `/api/r2/list-audio` returns `count > 0`
- [ ] `/library` page shows tracks in browser console

---

## What We Fixed

1. **R2 API** (`/api/r2/list-audio`):
   - Uses `R2_BUCKET_NAME` env var with fallback to `audio-files`
   - Handles pagination (lists ALL files, not just first 1000)
   - Returns debug info: `bucketUsed`, `bucketTried`, `count`

2. **Library Page** (`/library`):
   - Fetches from database (3 tables) + R2 bucket
   - Deduplicates by `audio_url`
   - Console logs: "Loaded X from DB + Y from R2 = Z unique tracks"

3. **Deploy Verification** (`/api/debug/deploy-info`):
   - Shows current git commit SHA
   - Shows which env vars are set
   - Helps verify production is running latest code

---

## Need Help?

If you're stuck, share these with me:
1. Response from `/api/debug/deploy-info`
2. Response from `/api/r2/list-audio` (especially `bucketUsed` and `count`)
3. Browser console output from `/library` page
