# Cloudflare R2 Storage Setup Guide

## Why R2 Storage?

- ✅ **Permanent URLs** - Replicate URLs expire after 24-48 hours
- ✅ **Cost Effective** - $0.015/GB storage (vs AWS S3 $0.023/GB)
- ✅ **No Egress Fees** - Free bandwidth (AWS charges $0.09/GB)
- ✅ **Fast Global CDN** - Cloudflare's edge network
- ✅ **User Organization** - Store media by user ID

---

## Step 1: Create Cloudflare R2 Bucket

### 1.1 Sign up for Cloudflare
1. Go to https://dash.cloudflare.com/sign-up
2. Create account (free tier available)
3. Verify email

### 1.2 Enable R2
1. In Cloudflare Dashboard → Click **R2**
2. Click **"Purchase R2 plan"** (includes 10GB free per month)
3. Click **"Create bucket"**
4. Bucket name: **`444radio-media`**
5. Location: **Automatic** (best performance)
6. Click **"Create bucket"**

### 1.3 Get API Credentials
1. In R2 Dashboard → Click **"Manage R2 API Tokens"**
2. Click **"Create API token"**
3. Token name: **`444radio-upload`**
4. Permissions:
   - ✅ **Object Read & Write**
5. Click **"Create API Token"**
6. **SAVE THESE** (you only see them once):
   ```
   Access Key ID: xxxxxxxxxxxxx
   Secret Access Key: xxxxxxxxxxxxxxxx
   Endpoint: https://xxxxx.r2.cloudflarestorage.com
   ```

---

## Step 2: Add Environment Variables

Add to `.env.local`:

```bash
# Cloudflare R2 Storage
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=444radio-media
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

Add to **Vercel** environment variables:
1. Go to https://vercel.com/dashboard
2. Select **444Radio** project
3. Settings → Environment Variables
4. Add all R2 variables above

---

## Step 3: Install Dependencies

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

R2 is S3-compatible, so we use AWS SDK.

---

## Step 4: Storage Library Structure

```
lib/
  storage/
    r2-client.ts       - R2 client configuration
    upload.ts          - Upload functions
    download.ts        - Download/retrieve functions
    delete.ts          - Delete functions
    types.ts           - TypeScript types
```

---

## Step 5: Enable Public Access

### Option A: Public Bucket (Recommended)
1. In R2 Dashboard → Select **444radio-media** bucket
2. Click **Settings**
3. Click **"Connect a custom domain"** or **"Allow public access"**
4. Enable **Public Access**
5. Get public URL: `https://pub-xxxxx.r2.dev`

### Option B: Custom Domain (Advanced)
1. Add your domain to Cloudflare
2. Create CNAME: `media.444radio.co.in` → R2 bucket
3. Use: `https://media.444radio.co.in`

---

## File Organization Structure

```
444radio-media/
  └── users/
      └── {userId}/
          ├── music/
          │   └── {timestamp}-{id}.mp3
          ├── images/
          │   └── {timestamp}-{id}.webp
          └── combined/
              └── {timestamp}-{id}.json
```

Example:
```
users/user_abc123/music/1729425600000-xyz.mp3
users/user_abc123/images/1729425600000-abc.webp
users/user_abc123/combined/1729425600000-combined.json
```

---

## Benefits

### Current (Replicate URLs)
- ❌ Expire after 24-48 hours
- ❌ Can't share long-term
- ❌ No user organization
- ❌ Pay per generation

### With R2 Storage
- ✅ Permanent URLs
- ✅ Share forever
- ✅ Organized by user
- ✅ Pay only for storage (~$0.015/GB)
- ✅ Free bandwidth
- ✅ Global CDN

---

## Cost Estimate

For 1000 users generating 10 tracks each:
- **Storage**: 10,000 tracks × 5MB = 50GB = **$0.75/month**
- **Bandwidth**: Unlimited = **$0.00**
- **Total**: **~$1/month**

vs Replicate (expires) or AWS S3 (~$4.50/month with bandwidth)

---

## Next Steps

1. ✅ Create Cloudflare account
2. ✅ Create R2 bucket
3. ✅ Get API credentials
4. ✅ Add environment variables
5. ✅ Install dependencies
6. ✅ Implement storage library (next step)

Ready to implement the library code!
