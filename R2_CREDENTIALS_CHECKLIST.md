# R2 Credentials Verification Checklist

## Current Signature Error
```
Failed to upload to permanent storage: The request signature we calculated does not match the signature you provided. Check your secret access key and signing method.
```

This error means **one or more credentials are incorrect** in Vercel.

---

## Required Environment Variables in Vercel

Go to: https://vercel.com/101worlds-projects/444-radio/settings/environment-variables

You need **exactly 5 variables**:

### 1. R2_ACCOUNT_ID
- **Value**: `95945bf0209126d122b1f04463871ebf`
- **Where to find**: Cloudflare Dashboard → R2 → Overview (top right)
- **Format**: 32-character hex string
- **Apply to**: Production, Preview, Development

### 2. R2_ACCESS_KEY_ID  
- **Value**: From Cloudflare API Token (when you rolled it)
- **Where to find**: You copied this when creating the API token
- **Format**: Looks like `4a8f2b5c3d6e1a7f9b2c8d4e5f3a1b6c`
- **Apply to**: Production, Preview, Development
- ⚠️ **CRITICAL**: This is NOT the token ID, it's the "Access Key ID"

### 3. R2_SECRET_ACCESS_KEY
- **Value**: From Cloudflare API Token (when you rolled it)
- **Where to find**: You copied this when creating the API token
- **Format**: Long string like `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0`
- **Apply to**: Production, Preview, Development
- ⚠️ **CRITICAL**: This is the SECRET key, shown only once when token created

### 4. R2_BUCKET_NAME
- **Value**: `444radio-media`
- **Where to find**: Cloudflare Dashboard → R2 → Buckets
- **Format**: Exact bucket name (case-sensitive)
- **Apply to**: Production, Preview, Development

### 5. R2_PUBLIC_URL
- **Value**: `https://pub-e5b6d4383c5547e891ae88829c469ed6.r2.dev`
- **Where to find**: Cloudflare Dashboard → R2 → 444radio-media bucket → Settings → Public URL
- **Format**: `https://pub-xxxxx.r2.dev` (no trailing slash)
- **Apply to**: Production, Preview, Development

---

## How to Get Fresh Credentials from Cloudflare

### If You Don't Have the API Token Values Anymore:

1. **Go to Cloudflare Dashboard**: https://dash.cloudflare.com/
2. **Navigate to R2**: Click R2 in sidebar
3. **Manage API Tokens**: Click "Manage R2 API Tokens"
4. **Delete Old Token**: 
   - Find `444radio-upload` token
   - Click "..." → Delete
5. **Create New Token**:
   - Click "Create API Token"
   - Token name: `444radio-upload-new`
   - Permissions: ✅ Object Read & Write
   - TTL: No expiration
   - Click "Create API Token"
6. **COPY IMMEDIATELY** (shown only once):
   ```
   Access Key ID: xxxxxxxxxxxxxx
   Secret Access Key: xxxxxxxxxxxxxx
   ```
7. **Paste into Vercel**:
   - R2_ACCESS_KEY_ID = Access Key ID
   - R2_SECRET_ACCESS_KEY = Secret Access Key

---

## Common Mistakes

### ❌ WRONG: Using Token ID instead of Access Key ID
- Token ID looks like: `abc123def456` (short)
- Access Key ID looks like: `4a8f2b5c3d6e1a7f9b2c8d4e5f3a1b6c` (long hex)

### ❌ WRONG: Mixing up endpoint formats
- DON'T use: `https://95945bf0209126d122b1f04463871ebf.r2.cloudflarestorage.com` in R2_PUBLIC_URL
- USE: `https://pub-e5b6d4383c5547e891ae88829c469ed6.r2.dev` in R2_PUBLIC_URL

### ❌ WRONG: Not applying to all environments
- Make sure each variable has: ✅ Production ✅ Preview ✅ Development

### ❌ WRONG: Adding extra spaces or quotes
- Don't wrap in quotes: `"95945bf0209126d122b1f04463871ebf"` ❌
- Just paste the value: `95945bf0209126d122b1f04463871ebf` ✅

---

## After Updating Variables

1. **Save each variable** (Vercel will ask to redeploy)
2. **OR manually redeploy**: 
   ```powershell
   vercel --prod
   ```
3. **Test generation** at https://444-radio.vercel.app/create
4. **Check URL format**: Should be `https://pub-e5b6d4383c5547e891ae88829c469ed6.r2.dev/users/...`

---

## Still Getting Signature Error?

### Double-check these specific things:

1. **Access Key ID** in Vercel matches **exactly** what Cloudflare showed
2. **Secret Access Key** in Vercel matches **exactly** what Cloudflare showed
3. **R2_ACCOUNT_ID** = `95945bf0209126d122b1f04463871ebf` (your account ID)
4. **No R2_ENDPOINT** variable (let it auto-build from account ID)
5. **All 5 variables** applied to Production environment

### Test locally (won't work without .env.local, but shows format):
```powershell
# Create .env.local with these 5 variables
# Then run:
npm run dev
# Try generation at http://localhost:3000/create
```

---

## Need Help?

If still failing after verifying all above:
1. Screenshot your Vercel environment variables page (hide the secret values)
2. Check Vercel deployment logs for exact error message
3. Verify token has "Object Read & Write" permissions in Cloudflare
