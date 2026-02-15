# 444Radio — Master Todo List (Deep Analysis)
> Generated 2026-02-15 after full codebase audit of every page, API route, component, context, config, and dependency.

---

## 🔴 TIER 1 — CRITICAL SECURITY & FINANCIAL (Fix Immediately)

### S1. `fix-subscription-plans` — No authentication
**File:** `app/api/fix-subscription-plans/route.ts`  
**Risk:** Any anonymous POST rewrites `subscription_plan` for every active user.  
**Fix:** Delete this route (one-time migration script, not a live route) or add admin guard.

### S2. `admin/activate-subscription` — No admin guard
**File:** `app/api/admin/activate-subscription/route.ts`  
**Risk:** Any authenticated user can POST a `razorpay_customer_id` to grant anyone 100 credits + active subscription.  
**Fix:** Add `if (clerkUserId !== ADMIN_ID)` check.

### S3. `debug/check-schema` — No auth, service role key, exposes DB schema
**File:** `app/api/debug/check-schema/route.ts`  
**Risk:** Public GET exposes all column names/types from `combined_media` via service role.  
**Fix:** Delete or add admin-only guard.

### S4. `debug/user-data` — IDOR (any user's data)
**File:** `app/api/debug/user-data/route.ts`  
**Risk:** Accepts `?userId=` param, returns full table rows for any user using service role key.  
**Fix:** Delete or restrict to admin only.

### S5. `studio/generate-beat` — Zero credit charge
**File:** `app/api/studio/generate-beat/route.ts`  
**Risk:** Full Replicate generation + R2 upload + DB save but **never deducts credits**. Free beats for everyone.  
**Fix:** Add `deduct_credits` RPC call before generation.

### S6. `studio/ai-effect` — Credits deducted AFTER generation
**File:** `app/api/studio/ai-effect/route.ts`  
**Risk:** Generation runs first, deduction after. If deduction fails, user keeps free audio.  
**Fix:** Deduct credits BEFORE calling Replicate.

### S7. `studio/webhook` — No signature verification
**File:** `app/api/studio/webhook/route.ts`  
**Risk:** Attacker can POST fake Replicate completion payloads to inject arbitrary audio into users' libraries.  
**Fix:** Add Replicate webhook signature verification.

### S8. Duplicate Razorpay webhook handlers
**Files:** `app/api/razorpay-webhook/route.ts` (old) + `app/api/webhooks/razorpay/route.ts` (canonical)  
**Risk:** If both are configured in Razorpay, payments process twice. Old route lacks idempotency.  
**Fix:** Delete old `razorpay-webhook/` route. Verify Razorpay dashboard points only to canonical endpoint.

### S9. PayPal webhook skips verification when env var missing
**File:** `app/api/webhooks/paypal/route.ts`  
**Risk:** If `PAYPAL_WEBHOOK_ID` is unset, handler logs warning and processes event without signature check.  
**Fix:** Reject event if webhook ID is not set.

---

## 🟠 TIER 2 — NON-ATOMIC CREDIT OPERATIONS (Race Conditions)

### C1. Studio routes — read/subtract/write pattern
All studio routes still use `read credits → subtract in JS → write back` instead of the atomic `deduct_credits` RPC. Under concurrent requests, users can over-spend.

| Route | Credit Cost | File |
|-------|-------------|------|
| `studio/generate` | variable | `app/api/studio/generate/route.ts` |
| `studio/generate-song` | 2 | `app/api/studio/generate-song/route.ts` |
| `studio/generate-effect` | variable | `app/api/studio/generate-effect/route.ts` |
| `studio/autotune` | 0.5 | `app/api/studio/autotune/route.ts` |

**Fix:** Migrate all to `deduct_credits` RPC (same pattern as `app/api/generate/effects/route.ts`).

### C2. Earn marketplace — non-atomic
| Route | Credit Cost | File |
|-------|-------------|------|
| `earn/purchase` | 5-10 | `app/api/earn/purchase/route.ts` |
| `earn/list` | 2 | `app/api/earn/list/route.ts` |

**Fix:** Same — migrate to `deduct_credits` RPC.

### C3. Webhook credit addition — non-atomic
Both `webhooks/razorpay` and `webhooks/paypal` read `user.credits`, add in JS, write back. If webhook retries before first write completes, credits double.  
**Fix:** Create `add_credits` RPC (mirror of `deduct_credits`) for atomic credit addition.

---

## 🟡 TIER 3 — BROKEN PAGES & FEATURES

### P1. Billboard page — completely empty
**File:** `app/billboard/page.tsx`  
`useEffect` has `// TODO: Fetch charts from API` and immediately sets `loading = false`. Always shows "No charts yet."  
**Fix:** Implement charting logic OR remove from navigation.

### P2. Community page — queries legacy `songs` table
**File:** `app/community/page.tsx`  
Queries `songs` table with `cover_url`/`prompt`/`genre` fields that don't exist in current schema. Uses native `<audio controls>` instead of `AudioPlayerContext`.  
**Fix:** Rewrite to query `combined_media` or delete page.

### P3. Music page — same legacy table bug + raw `<img>`
**File:** `app/music/page.tsx`  
Same `songs` table issue. Also uses `<img>` tag instead of `<Image>`, no loading state.  
**Fix:** Delete page (superseded by `/explore`) or rewrite.

### P4. Subscribe page — stale pricing, hardcoded link
**File:** `app/subscribe/page.tsx`  
Shows ₹499/month with hardcoded Razorpay link. Pricing page shows ₹450/month with dynamic checkout. Two conflicting subscription paths.  
**Fix:** Delete `/subscribe` and redirect to `/pricing`.

### P5. `private-lists/join` and `leave` — query nonexistent table
**Files:** `app/api/private-lists/join/route.ts`, `app/api/private-lists/leave/route.ts`  
Call `supabase.from('credits')` — the `credits` table does not exist. Column lives on `users` table.  
**Fix:** Change to `supabase.from('users')` or delete if feature is dead.

### P6. Profile page — liked tracks never hydrated
**File:** `app/profile/[userId]/page.tsx`  
`likedTracks` initialized as `new Set()` but never populated from API. Hearts always show un-liked on load.  
**Fix:** Fetch liked tracks on mount (`GET /api/library?type=liked` or similar).

### P7. Profile page — `ProfileUploadModal` rendered twice
**File:** `app/profile/[userId]/page.tsx`  
The avatar upload modal appears once unconditionally (~line 930) and again inside a conditional (~line 965). First one is always in DOM.  
**Fix:** Remove the unconditional render.

### P8. Generation timeout on Vercel
**File:** `vercel.json`  
`app/api/**/*.ts` wildcard sets `maxDuration: 10` (10 seconds). Generation endpoints need 30-120s for Replicate polling.  
**Fix:** Add `maxDuration: 120` override for `app/api/generate/**` and `app/api/studio/**` and `app/api/plugin/generate/**`.

---

## 🔵 TIER 4 — DUPLICATE / INCONSISTENT UI

### D1. Double sidebar on home page
**File:** `app/page.tsx` lines ~153-154  
Renders its own `<DockedSidebar />` + `<FloatingMenu />`, but `app/layout.tsx` already renders `<DockedSidebar />` globally. Users see two sidebars.  
**Fix:** Remove per-page sidebar/nav from home, explore, library, earn, etc. Let layout handle it.

### D2. Double credit badge on most pages
`CreditBadge` rendered globally in layout. `CreditIndicator` rendered per-page in create/explore/library/home. Users see two credit displays.  
**Fix:** Pick one. Remove per-page `CreditIndicator` or remove `CreditBadge` from layout.

### D3. Duplicate `GenerationType` value in create page
**File:** `app/create/page.tsx` line ~37  
`'effects'` listed twice in the union type. Missing `'loops'` or other type.  
**Fix:** Deduplicate and add missing types.

### D4. Duplicate `ProfileData` interface in username page
**File:** `app/u/[username]/page.tsx`  
Interface declared twice with different fields. TypeScript merges them silently.  
**Fix:** Merge into single interface.

### D5. ESC key behavior inconsistent across pages
| Page | ESC goes to |
|------|-------------|
| Create | `/` |
| Explore | `/create` |
| Library | `/profile/{userId}` |
| Pricing | `/explore` |
| Settings | (nothing) |
| Decrypt | `router.back()` |

**Fix:** Standardize — ESC always goes `router.back()` or remove custom ESC handling.

### D6. Background treatment inconsistent
- Home/explore/earn: Lazy-loaded `HolographicBackgroundClient`
- Community: Eagerly imported (perf hit)
- Profile/u/[username]: Eagerly imported
- Billboard/pricing/settings: Plain gradient
- Music: Plain `bg-gray-900`

**Fix:** Standardize — lazy-load everywhere or simplify to gradient.

### D7. Admin pages — no client-side auth guard
**Files:** `app/admin/earn-listings/page.tsx`, `app/admin/plugin-purchases/page.tsx`, `app/admin/sync/page.tsx`  
Rely on API returning 403 but UI renders fully before error. Unlike `adminrizzog` which checks `user?.id === ADMIN_ID`.  
**Fix:** Add client-side admin check to all admin pages.

### D8. Admin ID hardcoded in multiple files with different constant names
`ADMIN_CLERK_ID` in some files, `ADMIN_USER_ID` in others.  
**Fix:** Create `lib/constants.ts` exporting `ADMIN_CLERK_ID` once. Import everywhere.

---

## 🟢 TIER 5 — DEAD CODE CLEANUP

### Dead Pages (delete these files)
| File | Reason |
|------|--------|
| `app/music/page.tsx` | Superseded by `/explore` |
| `app/community/page.tsx` | Broken, no real community features |
| `app/subscribe/page.tsx` | Superseded by `/pricing` |
| `app/page_temp.tsx` | Temp file |
| `app/page-new.tsx` | Old iteration |
| `app/page-backup.tsx` | Backup |
| `app/page-from-git.txt` | Git dump |
| `app/explore/page-old.tsx` | Old version |
| `app/explore/page-new.tsx` | Old version |
| `app/pricing/page-old.tsx` | Old version |
| `app/pricing/page-new.tsx` | Old version |
| `app/library/page_backup_before_likes.tsx` | Old backup |
| `app/station/page.backup.tsx` | Backup |
| `app/studio/dawv2.0/page-old.tsx` | Old version |
| `app/studio/dawv2.0/page-old-broken.tsx` | Old version |
| `app/studio/dawv2.0/page-old-backup.tsx` | Old version |
| `app/studio/dawv2.0/page.backup.tsx` | Backup |
| `app/studio/dawv2.0/page-rebuilt.tsx` | Old version |
| `app/studio/dawv2.0/page-new.tsx` | Old version |

### Dead Components (delete these files)
| File | Reason |
|------|--------|
| `AnimatedBackground.tsx` | Zero imports |
| `BlackholeBackground.tsx` | Zero imports |
| `StarryBackground.tsx` | Zero imports |
| `HolographicBackground.tsx` | Superseded by `HolographicBackgroundClient.tsx` |
| `FMTuner.tsx` | Zero imports |
| `SonicDNAForm.tsx` | Zero imports |
| `CompletionModal.tsx` | Zero imports |
| `ReuploadWarningModal.tsx` | Zero imports |
| `R2StatusIndicator.tsx` | Zero imports |
| `AccessibleButton.tsx` | Zero imports |
| `GlobalAudioPlayer.tsx` | Zero imports, superseded by `FloatingAudioPlayer` |
| `GenerationModal.tsx` (root) | Zero imports, superseded by `MusicGenerationModal` |
| `UnifiedGenerationModal.tsx` | Zero imports |
| `SimpleGenerationSelector.tsx` | Zero imports |
| `SocialCTA.tsx` | Only imported in dead `explore/page-old.tsx` |
| `ReleaseModal.tsx` | Only imported in dead `library/page_backup` |
| `FloatingNavButton.backup.tsx` | Backup file |
| `studio/Timeline-old-backup.tsx` | Backup file |
| `studio/EffectsRack.tsx` OR `EffectRack.tsx` | Duplicate — determine which is used |
| `studio/StemSplitModal.tsx` OR `StemSplitterModal.tsx` | Duplicate — determine which is used |

### Dead Hooks
| File | Reason |
|------|--------|
| `hooks/useEscapeKey.ts` | Zero imports |
| `hooks/useWaveSurfer.ts` | Only in dead backup file |
| `hooks/useStudioGeneration.ts` | Zero imports |
| `hooks/useMultiTrack.optimized.ts` | Non-optimized version used instead |

### Dead API Routes
| File | Reason |
|------|--------|
| `app/api/razorpay-hook.ts` | Not a valid route (no `/route.ts`), never executes |
| `app/api/razorpay-test/route.ts` | Test stub, no auth |
| `app/api/rzp/route.ts` | Empty stub |
| `app/api/razorpay/webhook/route.ts` | Deprecated forwarding stub |
| `app/api/debug/check-schema/route.ts` | Security risk, should delete |
| `app/api/debug/deploy-info/route.ts` | No auth, unnecessary exposure |
| `app/api/fix-subscription-plans/route.ts` | One-time script, no auth |
| `app/api/studio/ai-effect/backupvmae...ts` | Backup file |

### Dead npm Dependencies
| Package | Evidence |
|---------|----------|
| `@hello-pangea/dnd` | Zero imports (app uses `@dnd-kit/*`) |
| `styled-components` | Zero imports (Tailwind only) |
| `@waveform-playlist/*` (6 packages) | Zero imports (app uses `wavesurfer.js`) |
| `tone` | Zero imports |
| `@types/three` | In `dependencies` — move to `devDependencies` |

---

## ⚪ TIER 6 — CONTEXT & CODE QUALITY

### Q1. AudioPlayerContext — duplicate `computeUrl` with divergent logic
**File:** `app/contexts/AudioPlayerContext.tsx` lines ~188 and ~379  
Preload version treats CDN R2 URLs as needing proxy; playback version exempts them. Inconsistent.  
**Fix:** Extract single `computeUrl` function.

### Q2. AudioPlayerContext — play tracking resets on pause
**File:** `app/contexts/AudioPlayerContext.tsx` lines ~452-455  
If user pauses at 2s, timer resets to 0. Must play another full 3s to register. Should accumulate.  
**Fix:** Track cumulative play time, don't reset on pause.

### Q3. AudioPlayerContext — `resume()` event dispatch outside null check
**File:** `app/contexts/AudioPlayerContext.tsx` lines ~118-131  
`audio:pause-studio` event fires even when `audioRef.current` is null.  
**Fix:** Move event dispatch inside the `if` block.

### Q4. CreditsContext — 30-second polling
**File:** `app/contexts/CreditsContext.tsx`  
Polls `/api/credits` every 30s for all authenticated users. Unnecessary load.  
**Fix:** Fetch once on mount + call `refreshCredits()` after mutations. Remove interval.

### Q5. UserSyncProvider never mounted
**File:** `app/components/UserSyncProvider.tsx`  
Component exists but is never imported in layout or anywhere. User sync never runs.  
**Fix:** Import in layout or delete.

### Q6. Create page — 3590 lines, 50+ state variables
**File:** `app/create/page.tsx`  
Massive monolithic component. Extremely hard to debug or modify.  
**Fix:** Decompose into sub-components (generation form, preview, queue display, etc.).

### Q7. Library page — 14 parallel API calls on mount
**File:** `app/library/page.tsx`  
Fires 14 `fetch()` calls simultaneously. Failed calls silently show empty tabs.  
**Fix:** Add error states per tab. Consider consolidating into fewer API calls.

### Q8. Username profile — 6-column forced grid on mobile
**File:** `app/u/[username]/page.tsx`  
`grid grid-cols-6` on all screen sizes. At 375px each cell is ~55px.  
**Fix:** Use responsive grid: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6`.

### Q9. Username profile — no profile header
**File:** `app/u/[username]/page.tsx`  
No avatar, bio, follower count, or banner. Just a bare grid with bottom bar.  
**Fix:** Add proper profile header matching `/profile/[userId]` design.

### Q10. No admin index page
`/admin` returns 404. Only sub-routes work.  
**Fix:** Create `app/admin/page.tsx` with links to admin tools.

### Q11. Missing CORS on 13+ routes
Routes that lack `corsResponse()` and `OPTIONS` handler:
`credits/award`, `generate/music`, `generate/image`, `generate/video`, `generate/music-only`, `generate/image-only`, `generate/extract-audio-stem`, `generate/video-to-audio`, `subscriptions/status`, `private-lists/*`, `adminrizzog`  
**Fix:** Add CORS wrappers to all.

### Q12. `globals.css` — duplicate animations
Duplicate `@keyframes spin-slow`, `@keyframes gradient`, `.animate-spin-slow`, `.animate-gradient`, and conflicting `.custom-scrollbar` definitions.  
**Fix:** Deduplicate.

### Q13. `next.config.ts` — `images.unoptimized: true` makes format config dead
`formats: ['image/avif', 'image/webp']` and `minimumCacheTTL` are ignored when `unoptimized: true`.  
**Fix:** Remove dead image optimization config, or enable optimization.

### Q14. Station page — no error boundary for WebRTC
**File:** `app/station/page.tsx` (1438 lines)  
Complex WebRTC logic with no `ErrorBoundary` wrapper. Crashes without recovery on mobile.  
**Fix:** Wrap in ErrorBoundary.

---

## 📊 SUMMARY

| Tier | Count | Category |
|------|-------|----------|
| 🔴 TIER 1 | 9 | Critical security/financial |
| 🟠 TIER 2 | 3 | Non-atomic credit race conditions |
| 🟡 TIER 3 | 8 | Broken pages & features |
| 🔵 TIER 4 | 8 | Duplicate/inconsistent UI |
| 🟢 TIER 5 | ~50 files | Dead code cleanup |
| ⚪ TIER 6 | 14 | Code quality improvements |

**Total: 92+ action items across 6 priority tiers.**

---

## RECOMMENDED ATTACK ORDER

1. **Hour 1-2:** Fix all Tier 1 security issues (S1-S9) — delete dangerous debug routes, add admin guards, fix credit charging
2. **Hour 3-4:** Migrate Tier 2 studio/earn routes to atomic `deduct_credits` RPC
3. **Hour 5-6:** Fix Tier 3 broken pages — delete dead pages, fix generation timeout, fix liked tracks
4. **Hour 7-8:** Resolve Tier 4 UI duplicates — remove double sidebar/badges, standardize nav
5. **Day 2:** Tier 5 dead code purge — delete ~50 dead files, remove unused npm deps
6. **Day 3:** Tier 6 quality improvements — fix contexts, decompose mega-components, add CORS
