# R2 Quick Setup - Final Steps

## ✅ What's Done
- R2 Account ID: `95945bf0209126d122b1f04463871ebf`
- R2 Endpoint: `https://95945bf0209126d122b1f04463871ebf.r2.cloudflarestorage.com`
- Environment file updated with R2 configuration

---

## 🔑 What You Need to Add

### Step 1: Get Your API Credentials from Cloudflare

1. Go to: https://dash.cloudflare.com/
2. Click **R2** in the sidebar
3. Click **Manage R2 API Tokens**
4. Click **Create API Token**
5. Configure:
   - **Token Name**: `444radio-production`
   - **Permissions**: ✅ Object Read & Write
   - **Bucket**: Select `444radio-media` (or All buckets)
6. Click **Create API Token**
7. **SAVE THESE VALUES** (shown only once):
   - Access Key ID
   - Secret Access Key

### Step 2: Update `.env.local`

Replace these two lines in `.env.local`:

```bash
R2_ACCESS_KEY_ID=YOUR_ACCESS_KEY_ID_HERE
R2_SECRET_ACCESS_KEY=YOUR_SECRET_ACCESS_KEY_HERE
```

With your actual credentials from Step 1.

### Step 3: Get Your Public Bucket URL

1. In Cloudflare R2 dashboard
2. Click on bucket `444radio-media`
3. Go to **Settings** tab
4. Find **Public Access** section
5. Enable **Allow Access** 
6. Copy the **Public Bucket URL** (looks like: `https://pub-xxxxx.r2.dev`)

### Step 4: Update Public URL in `.env.local`

Replace this line:

```bash
R2_PUBLIC_URL=https://pub-YOUR_PUBLIC_ID.r2.dev
```

With your actual public URL from Step 3.

---

## 🧪 Test Your Setup

After adding credentials, test with this command:

```bash
npm run dev
```

Then in another terminal:

```powershell
# Test upload endpoint
curl -X POST http://localhost:3000/api/storage/upload `
  -H "Content-Type: application/json" `
  -d '{"sourceUrl":"https://example.com/test.mp3","folder":"music","fileName":"test.mp3"}'
```

If configured correctly, you should get a response with a permanent R2 URL!

---

## 📝 Final `.env.local` Should Look Like:

```bash
# ... your existing keys ...

# Cloudflare R2 Storage
R2_ACCOUNT_ID=95945bf0209126d122b1f04463871ebf
R2_ENDPOINT=https://95945bf0209126d122b1f04463871ebf.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=abc123xyz456...  # ← Your actual Access Key ID
R2_SECRET_ACCESS_KEY=secretKey789...  # ← Your actual Secret Key
R2_BUCKET_NAME=444radio-media
R2_PUBLIC_URL=https://pub-abc123.r2.dev  # ← Your actual public URL
```

---

## 🚀 Next Steps After Configuration

Once credentials are added, I can:

1. ✅ Integrate R2 uploads into music generation
2. ✅ Integrate R2 uploads into image generation  
3. ✅ Update combined media to use permanent URLs
4. ✅ Test the complete flow

Let me know when you've added the credentials!
