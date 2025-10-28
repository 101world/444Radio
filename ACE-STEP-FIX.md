# ACE-Step Model Fix - MiniMax Fallback

## Issue
ACE-Step model version `"lucataco/ace-step:latest"` was causing **422 Unprocessable Entity** errors:
```
Request to https://api.replicate.com/v1/predictions failed with status 422 Unprocessable Entity: 
{"title":"Invalid version or not permitted","detail":"The specified version does not exist (or perhaps you don't have permission to use it?)","status":422}
```

## Root Cause
The ACE-Step model version string was invalid. Replicate requires specific version hashes, not `:latest` tags.

## Solution
**Used MiniMax Music-1.5 for all languages** (including non-English) as a reliable fallback:

### Files Changed
1. **`app/api/generate/music-only/route.ts`**
   - Removed ACE-Step generation code
   - Uses MiniMax Music-1.5 for all languages
   - Simplified logic (no language branching)

2. **`app/api/generate/music/route.ts`**
   - Removed ACE-Step generation code
   - Uses MiniMax Music-1.5 for all languages
   - Removed language-based model selection

### MiniMax Music-1.5 Capabilities
- ✅ Multi-language support (English, Chinese, Japanese, Korean, Spanish, etc.)
- ✅ Lyrics-to-music generation
- ✅ Style control via `style_strength` parameter
- ✅ 600 character lyrics limit
- ✅ High-quality audio output
- ✅ Fast generation (~30-60 seconds)

### ACE-Step UI Status
**Kept in Create page** for future use if ACE-Step becomes available:
- UI parameters: `audioLengthInSeconds`, `numInferenceSteps`, `guidanceScale`, `denoisingStrength`
- Hidden when language is English
- Parameters currently **not used** by MiniMax (fallback values ignored)
- Ready to wire up if ACE-Step model hash is obtained

## Testing
1. Generate music with English lyrics → Works ✅
2. Generate music with Japanese lyrics → Works ✅
3. Generate music with Korean lyrics → Works ✅
4. Generate music with Chinese lyrics → Works ✅

## Future Enhancement
If ACE-Step model becomes available:
1. Get valid version hash from Replicate
2. Uncomment ACE-Step code in both route files
3. Update version string to valid hash
4. Test with all languages
5. Wire up ACE-Step parameters from Create page

## API Behavior
**Before fix:**
```typescript
// ❌ Failed
version: "lucataco/ace-step:latest"
```

**After fix:**
```typescript
// ✅ Works
version: "minimax/music-1.5"
```

## Credits
No changes to credit deduction logic. Generation failures still refund credits correctly.

---

**Status:** ✅ FIXED - Music generation working for all languages
**Date:** October 29, 2025
**Next:** Implement multi-track studio (see `MULTI-TRACK-IMPLEMENTATION-PLAN.md`)
