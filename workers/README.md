# Cloudflare Worker Deployment Guide

## Phase A & B: Zero-Cost Audio Streaming with Security

This worker provides:
- **Range request support** (206 Partial Content)
- **Edge caching** with normalized 64KB blocks
- **HEAD metadata** for fast lookups
- **HMAC signed URLs** for security
- **Static asset serving** with immutable cache
- **Protected debug endpoint**

## Prerequisites

1. **Cloudflare Account** with Workers and R2 access
2. **Wrangler CLI** installed globally:
   ```bash
   npm install -g wrangler
   ```

3. **R2 Bucket** named `audio-files` (already exists)

## Setup Steps

### 1. Configure Environment Variables

Edit `workers/wrangler.toml`:

```toml
[vars]
DEBUG_TOKEN = "your-secure-random-token-here"
SIGNING_SECRET = "your-signing-secret-here"  # Must match Next.js
```

Generate secure secrets:
```bash
# On Linux/Mac
openssl rand -hex 32

# On Windows PowerShell
[System.Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

### 2. Update Next.js Environment Variables

Add to `.env.local`:
```env
AUDIO_WORKER_URL=https://audio-worker.your-subdomain.workers.dev
AUDIO_SIGNING_SECRET=<same-as-wrangler-SIGNING_SECRET>
```

### 3. Deploy the Worker

```bash
cd workers
npm install
wrangler login  # If not already logged in
wrangler deploy
```

### 4. Configure Custom Domain (Optional)

In Cloudflare Dashboard:
1. Go to Workers & Pages → audio-worker → Settings → Triggers
2. Add Custom Domain: `audio.yourdomain.com`

Update `AUDIO_WORKER_URL` in `.env.local` accordingly.

## Testing

### Test Range Requests (206)
```bash
curl -H "Range: bytes=0-1023" https://audio-worker.your-subdomain.workers.dev/audio/test-file.mp3
```

Expected response:
- Status: `206 Partial Content`
- Headers: `Content-Range: bytes 0-1023/...`

### Test HEAD Metadata
```bash
curl -I https://audio-worker.your-subdomain.workers.dev/audio/test-file.mp3
```

Expected headers:
- `Content-Length: ...`
- `Accept-Ranges: bytes`
- `Content-Type: audio/mpeg`

### Test Edge Caching
```bash
# First request - MISS
curl -H "Range: bytes=0-65535" https://...

# Second request - HIT
curl -H "Range: bytes=0-65535" https://...
```

Check `CF-Cache-Status` header.

### Test Signed URLs
```bash
# Generate signed URL via Next.js API
curl -X POST https://444radio.vercel.app/api/audio/signed-url \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key": "test-file.mp3", "ttl": 3600}'

# Use the returned signedUrl
curl "https://audio-worker...?exp=...&sig=..."
```

### Test Debug Endpoint
```bash
curl "https://audio-worker.your-subdomain.workers.dev/debug/audio-stats/test-file.mp3?token=YOUR_DEBUG_TOKEN"
```

Expected JSON with cache stats and timings.

## Integration with Next.js

### Update Audio Player to Use Worker

Replace R2 direct URLs with signed Worker URLs:

```typescript
// Before
const audioUrl = `${process.env.NEXT_PUBLIC_R2_AUDIO_URL}/${key}`;

// After
const response = await fetch('/api/audio/signed-url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key, ttl: 3600 })
});
const { signedUrl } = await response.json();
const audioUrl = signedUrl;
```

## Cost Monitoring

All features are **zero-cost** under Cloudflare's free tier:
- Workers: 100,000 requests/day
- R2: 10 GB storage, 1M Class A operations/month
- KV: 100,000 reads/day

Monitor usage in Cloudflare Dashboard → Workers & Pages → Metrics.

## Troubleshooting

### 401 Unauthorized on signed URLs
- Check `SIGNING_SECRET` matches between Worker and Next.js
- Verify signature generation algorithm (HMAC-SHA256)
- Check URL hasn't expired (`exp` parameter)

### Cache not working
- Verify normalized block alignment (64KB = 65536 bytes)
- Check cache storage quota in Worker metrics
- Test with consistent range headers

### CORS errors
- Update `Access-Control-Allow-Origin` in worker to your domain
- Add domain to allowed origins list

## Phase C: Client Updates (Next Step)

See `WORKER-INTEGRATION.md` for client-side implementation details.
