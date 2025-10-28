# ACE-Step Model Fix - Correct API Schema Implementation

## Issue #1: Invalid Version String
ACE-Step model version `"lucataco/ace-step:latest"` was causing **422 Unprocessable Entity** errors:
```
Request to https://api.replicate.com/v1/predictions failed with status 422 Unprocessable Entity: 
{"title":"Invalid version or not permitted","detail":"The specified version does not exist (or perhaps you don't have permission to use it?)","status":422}
```

## Issue #2: Missing Required Field
After fixing version, got new **422 error**:
```
{"detail":"- input: prompt is required\n","status":422,"title":"Input validation failed","invalid_fields":[{"type":"required","field":"input","description":"prompt is required"}]}
```

## Root Causes
1. Invalid version string - needs specific hash, not `:latest`
2. Wrong API schema - ACE-Step uses `tags` (not `prompt`) and has completely different parameters

## Solution
**Implemented correct ACE-Step API schema:**

### Correct ACE-Step Input Schema
```typescript
{
  tags: string,              // REQUIRED: Genre/style tags (e.g., "rock,epic,cinematic")
  lyrics?: string,           // Optional: Song lyrics with [verse], [chorus], [bridge]
  duration?: number,         // Optional: 1-240 seconds (default 60)
  number_of_steps?: number,  // Optional: 10-200 (default 60)
  guidance_scale?: number,   // Optional: 0-30 (default 15)
  scheduler?: 'euler' | 'heun',
  guidance_type?: 'apg' | 'cfg' | 'cfg_star',
  seed?: number              // -1 for random
}
```

### Files Changed
1. **`app/api/generate/music-only/route.ts`**
   - ✅ Correct version hash: `lucataco/ace-step:6b1a5b1e8e82f73fc60e3b9046e56f12b29ad3ac3f5ea43e4f3e84e638385068`
   - ✅ Extract genre tags from prompt for required `tags` field
   - ✅ Use `lyrics` instead of inline prompt
   - ✅ Map our params to ACE-Step params: `duration`, `number_of_steps`, `guidance_scale`
   - ✅ Add `scheduler: 'euler'` and `guidance_type: 'apg'`

2. **`app/api/generate/music/route.ts`**
   - ✅ Language-based model selection restored
   - ✅ English → MiniMax Music-1.5
   - ✅ Non-English → ACE-Step with correct schema

### Genre Tag Extraction
```typescript
// Extract genre from prompt for tags field
const genreTags = prompt.toLowerCase().match(
  /\b(rock|pop|jazz|blues|electronic|classical|hip hop|rap|country|metal|folk|reggae|indie|funk|soul|rnb|edm|house|techno|ambient|chill|lofi)\b/g
) || ['music'];
const tags = genreTags.join(',') || 'instrumental,melodic';
```

### Parameter Mapping
| Our Parameter | ACE-Step Parameter | Default | Range |
|---------------|-------------------|---------|-------|
| `prompt` | `tags` (extracted) | 'music' | Genre tags |
| `lyrics` | `lyrics` | formattedLyrics | 600 chars max |
| `audio_length_in_s` | `duration` | 60 | 1-240 seconds |
| `num_inference_steps` | `number_of_steps` | 60 | 10-200 |
| `guidance_scale` | `guidance_scale` | 15 | 0-30 |
| (new) | `scheduler` | 'euler' | euler/heun |
| (new) | `guidance_type` | 'apg' | apg/cfg/cfg_star |
| (new) | `seed` | -1 | Random |

---

**Status:** ✅ FIXED - Music generation working for all languages
**Date:** October 29, 2025
**Next:** Implement multi-track studio (see `MULTI-TRACK-IMPLEMENTATION-PLAN.md`)
