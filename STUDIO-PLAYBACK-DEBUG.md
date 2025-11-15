# Studio Playback Debug Guide

## What We Fixed
1. ✅ R2 CORS: All R2 URLs now proxy via `/api/r2/proxy`
2. ✅ Effect generation: Uploads to R2, returns stable URLs
3. ✅ Timeline loader: Detects and proxies R2 domains
4. ✅ Audio player: Proxies R2 in global player context

## Quick Test Checklist

### Test 1: Library Import + Playback
1. Open Studio Multi-Track
2. Click Library icon → select any track from your library
3. Track should appear on timeline with waveform
4. Press **Space** or Play button
5. **Expected**: Audio plays immediately
6. **Check Console**: Should NOT see "Failed to load audio buffer" or CORS errors

### Test 2: User Upload + Playback
1. Click Upload icon → select local MP3/WAV
2. Track appears on timeline
3. Press Play
4. **Expected**: Audio plays
5. **Check Console**: No fetch/CORS errors

### Test 3: Generated Effect + Playback
1. Select a track with audio
2. Track Inspector → "Generate Audio Effect"
3. Enter prompt: "warm analog tape"
4. Set duration: 10s
5. Click Generate
6. **Expected**: 
   - Preview appears in ~5-10 seconds
   - Audio player shows in preview section
   - Click "Send to Track" → clip appears on timeline
   - Press Play → effect plays

### Test 4: Multiple Tracks Sync
1. Add 2-3 tracks from library
2. Press Play
3. **Expected**: All tracks play simultaneously, synchronized

## Common Issues & Fixes

### Issue: "Failed to load audio buffer"
**Cause**: URL not being proxied
**Check**:
```javascript
// Open DevTools Console, run:
console.log(process.env.NEXT_PUBLIC_R2_AUDIO_URL)
```
**Fix**: Ensure env has:
- `NEXT_PUBLIC_R2_AUDIO_URL=https://pub-e5b60d303c5547e891ae88829c469ed6.r2.dev`
- Or your custom domain

### Issue: "CORS policy blocked"
**Cause**: Direct fetch bypassing proxy
**Check Console**: Look for URLs NOT starting with `/api/r2/proxy`
**Fix**: Already implemented in code; verify deployment picked up latest commit

### Issue: "408 timeout" on effect generation
**Check Server Logs** (Vercel → Functions → Logs):
- Should see: "⏳ Effect status: starting/processing/succeeded"
- If stuck on "processing", Replicate model may be slow
**Current timeout**: 180 seconds

### Issue: Timeline plays but no sound
**Check**:
1. Master volume (bottom right) - should be ~80%
2. Track volume sliders - should be 100%
3. Mute buttons - should NOT be red
4. Browser tab not muted
5. DevTools Console → AudioContext state should be "running"

### Issue: Effect preview works but won't add to track
**Check**: 
- "Send to Track" button should dispatch success toast
- Console should show: "Generated audio added to track"

## Debug Commands (Browser Console)

### Check if AudioContext is running:
```javascript
// Should log "running"
const ctx = new (window.AudioContext || window.webkitAudioContext)();
console.log('AudioContext state:', ctx.state);
```

### Force resume AudioContext:
```javascript
const ctx = new (window.AudioContext || window.webkitAudioContext)();
ctx.resume().then(() => console.log('Resumed!'));
```

### Check proxy detection:
```javascript
const testUrl = 'https://pub-e5b60d303c5547e891ae88829c469ed6.r2.dev/test.mp3';
const shouldProxy = testUrl.includes('.r2.dev') || testUrl.includes('.r2.cloudflarestorage.com');
console.log('Will proxy:', shouldProxy);
```

## Server-Side Logs (Vercel)

### Effect Generation Success Pattern:
```
🎨 Generating effect: { prompt: '...', duration: 10 }
🎯 Trying pinned version: 80d7a3ff...
⏳ Effect status: processing
⏳ Effect status: succeeded
✅ Effect generated: https://replicate.delivery/...
☁️ Uploaded effect to R2: https://pub-xxx.r2.dev/users/.../effects/...
```

### R2 Proxy Success Pattern:
```
GET /api/r2/proxy?url=https://pub-xxx.r2.dev/...
Status: 200
Headers: Content-Type: audio/mpeg, Access-Control-Allow-Origin: *
```

## Next Steps if Still Broken

### If effect generation fails:
1. Check Vercel env has `REPLICATE_EFFECTS_VERSION` set
2. Check server logs for "❌ All models failed"
3. Paste error details

### If playback fails:
1. Open DevTools → Network tab
2. Filter by "audio" or "mp3"
3. Check which requests are failing
4. Paste:
   - Request URL
   - Status code
   - Response preview

### If CORS still appears:
1. Verify deployment timestamp > latest commit time
2. Check env vars are in "Production" scope, not just "Preview"
3. Hard refresh: Ctrl+Shift+R

## Expected Working Flow

1. **Library track** → proxy via `/api/r2/proxy` → decode → play ✅
2. **Uploaded file** → local blob URL → decode → play ✅
3. **Generated effect** → Replicate → upload to R2 → return R2 URL → proxy → play ✅
4. **All tracks** → parallel decode → synchronized start at currentTime → master mix ✅

## Files Involved

- `hooks/useMultiTrack.ts` - Timeline audio loading & playback
- `app/contexts/AudioPlayerContext.tsx` - Global player (library/explore)
- `app/api/studio/generate-effect/route.ts` - Effect generation + R2 upload
- `app/api/r2/proxy/route.ts` - CORS-safe audio streaming
- `app/components/studio/TrackInspector.tsx` - Effect UI
- `app/components/studio/Timeline.tsx` - Track rendering
- `app/components/studio/TransportBar.tsx` - Play/pause controls

## Current Code Status

- ✅ Committed: "studio: broaden R2 proxy detection; robust effect output; upload to R2; extend timeout"
- ✅ Deployed: Empty commit to trigger redeploy with new env
- ⏳ Awaiting: Vercel build completion (check Deployments tab)
