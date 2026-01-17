# Critical Fixes - January 17, 2026

## Issues Identified

1. **R2 Image URL Selector Error**: Invalid CSS selector due to newline characters (`\a`) in R2 URLs
2. **Credit Deduction Issue**: Credits only deducted for one generation when hitting 2-3 simultaneously
3. **Generation State Stuck**: Shows "generating" when switching tabs but song appears in library
4. **Razorpay Checkout Errors**: EMPTY_WORDMARK 404 and data:;base64 invalid URL
5. **WebGL Context Overflow**: Too many WebGL contexts being created

## Root Causes

### 1. R2 URL Selector Error
- **Cause**: R2 URLs contain special characters that break CSS selectors
- **Location**: Next.js image preload logic
- **Fix**: Sanitize URLs or disable automatic image preloading (handled by Next.js - no action needed)

### 2. Credit Deduction Race Condition
- **Cause**: Multiple generations can start simultaneously before credit check completes
- **Location**: `app/create/page.tsx` - `handleGenerate()` and `processQueue()`
- **Fix**: ✅ Added credit locking mechanism with fresh credit fetch and pending credit tracking

### 3. Generation State Persistence
- **Cause**: Local state (`isGenerating`) not synced with actual generation completion
- **Location**: `app/create/page.tsx` - generation queue system
- **Fix**: ✅ Properly update message state when generation completes and refetch credits

### 4. Razorpay Checkout Errors
- **Cause**: Missing logo/wordmark URL in payment link configuration
- **Location**: `app/api/subscriptions/create/route.ts`
- **Fix**: ✅ Added optional brand logo configuration to payment links

### 5. WebGL Context Overflow
- **Cause**: Multiple Three.js contexts not being properly cleaned up
- **Location**: Pages with 3D visualizations
- **Fix**: ✅ Implemented WebGL context manager with automatic cleanup

## Fixes Applied

### Fix 1: Credit Deduction Race Condition ✅
**File**: `app/create/page.tsx`

Added fresh credit fetch before each generation to prevent race conditions:
- Fetches current credits from API before generation
- Calculates pending credits from active generations
- Prevents new generation if insufficient available credits
- Logs credit check details for debugging

```typescript
// Fetch fresh credits to prevent race conditions
const freshCreditsRes = await fetch('/api/credits')
const freshCreditsData = await freshCreditsRes.json()
const currentCredits = freshCreditsData.credits || 0

// Check pending credits
const pendingCredits = activeGenerations.size * (selectedType === 'music' ? 2 : 1)
const availableCredits = currentCredits - pendingCredits
```

### Fix 2: Generation State Sync ✅
**File**: `app/create/page.tsx`

Improved generation state management:
- Updates message state by both `messageId` and `generationId`
- Refetches credits after generation completion
- Properly cleans up active generations in finally block
- Logs cleanup operations for debugging

```typescript
// Update message with result - mark as NOT generating
setMessages(prev => prev.map(msg => 
  msg.id === messageId || msg.generationId === genId
    ? { ...msg, isGenerating: false, content: '✅ Track generated!', result }
    : msg
))
```

### Fix 3: Razorpay Checkout Configuration ✅
**File**: `app/api/subscriptions/create/route.ts`

Added brand logo support to prevent EMPTY_WORDMARK error:
- Checks for optional `NEXT_PUBLIC_BRAND_LOGO_URL` env variable
- Adds checkout options with brand name and logo if available
- Prevents 404 error on Razorpay's default wordmark endpoint

```typescript
// Add options to prevent EMPTY_WORDMARK error
const brandLogoUrl = process.env.NEXT_PUBLIC_BRAND_LOGO_URL
if (brandLogoUrl) {
  paymentLinkBody.options = {
    checkout: {
      name: '444Radio',
      image: brandLogoUrl
    }
  }
}
```

### Fix 4: WebGL Context Manager ✅
**File**: `lib/webgl-manager.ts` (new)

Created centralized WebGL context management:
- Tracks active WebGL contexts (max 8)
- Automatically cleans up oldest context when limit reached
- Provides cleanup functions for components
- Prevents "Too many active WebGL contexts" errors

**Integrated into**: `app/components/HolographicBackgroundClient.tsx`

```typescript
// Register context on creation
const gl = renderer.getContext()
registerWebGLContext(gl)

// Cleanup on unmount
cleanupContext(gl)
```

## Environment Variables

Add to Vercel dashboard (optional):

```env
# Brand logo for Razorpay checkout (optional)
# If not set, Razorpay will use default branding
NEXT_PUBLIC_BRAND_LOGO_URL=https://images.444radio.co.in/logo-square.png
```

## Testing Checklist

- [ ] Multiple generations: Start 3 music generations rapidly - credits should deduct correctly for each
- [ ] Generation state: Switch tabs during generation - state should sync when returning
- [ ] Razorpay checkout: Click subscription plan - no EMPTY_WORDMARK or base64 errors
- [ ] WebGL contexts: Navigate between pages with 3D backgrounds - no context limit warnings
- [ ] Credits display: Credits should update immediately after each generation completes

## Deployment

1. **Commit changes**:
   ```powershell
   git add .
   git commit -m "Fix: Credit race conditions, generation state sync, Razorpay errors, WebGL cleanup"
   git push origin master
   ```

2. **Add environment variable** (optional):
   - Go to Vercel → Project → Settings → Environment Variables
   - Add: `NEXT_PUBLIC_BRAND_LOGO_URL` = `https://images.444radio.co.in/logo-square.png`
   - Redeploy

3. **Verify fixes**:
   - Test multiple simultaneous generations
   - Check Razorpay checkout flow
   - Monitor console for WebGL warnings

## Monitoring

Watch for these in logs after deployment:
- `[Credit Check]` - Should show proper credit calculations
- `[Generation]` - Should show cleanup operations
- `[WebGL]` - Should show context registration/cleanup
- No "Too many active WebGL contexts" warnings
- No "EMPTY_WORDMARK" 404 errors in Razorpay checkout

