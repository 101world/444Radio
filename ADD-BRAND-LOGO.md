# Add Brand Logo to Fix EMPTY_WORDMARK Error

## The Problem
Razorpay checkout is trying to load "EMPTY_WORDMARK" as a literal URL, causing 404 errors.

## The Solution
The code fix is already deployed. You just need to add the environment variable.

## Steps to Fix (2 minutes)

### Option 1: Via Vercel Dashboard (Recommended)

1. Go to: https://vercel.com/101world/444radio/settings/environment-variables

2. Click **"Add New"**

3. Fill in:
   - **Key**: `NEXT_PUBLIC_BRAND_LOGO_URL`
   - **Value**: `https://images.444radio.co.in/logo-square.png`
   - **Environments**: Select all (Production, Preview, Development)

4. Click **"Save"**

5. Go to: https://vercel.com/101world/444radio
   - Click **"Redeploy"** button on the latest deployment
   - OR wait for next git push to trigger auto-deploy

### Option 2: Via Vercel CLI (Alternative)

```powershell
# Install Vercel CLI if not already installed
npm i -g vercel

# Add environment variable
vercel env add NEXT_PUBLIC_BRAND_LOGO_URL production
# When prompted, paste: https://images.444radio.co.in/logo-square.png

# Redeploy
vercel --prod
```

## Verification

After redeploying:

1. Go to: https://444radio.co.in/pricing
2. Click any subscription plan
3. Open Developer Console (F12)
4. Check for errors - EMPTY_WORDMARK error should be gone
5. Payment page should show "444Radio" branding

## If You Don't Have a Logo Yet

Use Razorpay's default branding by setting:

```
NEXT_PUBLIC_BRAND_LOGO_URL=https://cdn.razorpay.com/static/assets/logo/payment.svg
```

Or create a square logo (recommended size: 256x256px) and upload to:
```
https://images.444radio.co.in/logo-square.png
```

## About the "Refused to get unsafe header" Warnings

These warnings are **NORMAL** and safe to ignore:
- `Refused to get unsafe header "x-rtb-fingerprint-id"`
- These are Razorpay's security headers
- Browser blocks access for security reasons
- Does not affect functionality

## Expected Result

**Before:**
```
❌ EMPTY_WORDMARK 404 error
❌ Generic Razorpay branding
```

**After:**
```
✅ No EMPTY_WORDMARK error
✅ Custom "444Radio" branding
✅ Professional checkout experience
```

## Troubleshooting

**Q: I added the variable but still see the error**
- A: You need to redeploy after adding env variables
- Click "Redeploy" in Vercel dashboard

**Q: My logo doesn't appear**
- A: Check the URL is publicly accessible
- Try: `curl -I https://images.444radio.co.in/logo-square.png`
- Should return `200 OK`

**Q: Can I skip this?**
- A: Yes, the checkout works without it
- But you'll see the 404 warning in console
- Users won't notice the error, only in developer console

---

**Status**: Fix deployed, waiting for env variable
**Next**: Add `NEXT_PUBLIC_BRAND_LOGO_URL` to Vercel
**ETA**: 2 minutes + redeploy time (~3 minutes)
