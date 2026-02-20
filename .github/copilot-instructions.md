# 444Radio — Copilot Instructions for AI Coding Agents# 444Radio — Copilot Instructions for AI Coding Agents



AI-powered music social network ("Instagram for AI Music") built with Next.js 15 + Clerk + Supabase + Cloudflare R2 + Replicate, deployed on Vercel.These are the project-specific guardrails and shortcuts to help you ship changes confidently in this Next.js 15 + Clerk + Supabase + Cloudflare R2 app deployed on Vercel.



## Architecture & Data Flow## Architecture and data flow

- App Router layout under `app/**`; API routes live at `app/api/**/route.ts` (Request/Response handlers).

### Core Stack- Auth is enforced globally via `middleware.ts` with Clerk. Public routes: `/`, `/sign-in`, `/sign-up`, `/api/webhook`. Everything else requires auth.

- **Frontend**: Next.js 15 App Router (`app/**`), React 19, TypeScript, Tailwind CSS- User lifecycle: Clerk → Svix webhook → `app/api/webhook/route.ts` → inserts/updates/deletes rows in `supabase` `users` table.

- **Auth**: Clerk with global middleware protection (`middleware.ts`)- Content: audio/images/videos uploaded to Cloudflare R2 via `lib/r2-upload.ts` and read across pages (e.g., Radio, Library). Playback is centralized by `app/contexts/AudioPlayerContext.tsx` which also tracks plays via `/api/media/track-play` (fallback `/api/songs/track-play`).

- **Database**: Supabase PostgreSQL (primary table: `combined_media` for all content types)- AI: Replicate token is configured but model endpoints are under `app/api/generate/**` (see folder) and may need wiring depending on feature.

- **Storage**: Cloudflare R2 (buckets: `audio-files`, `images`, `videos`)

- **AI**: Replicate API for music/image generation (`app/api/generate/**`)## Local dev, build, and migrations

- Dev server (Turbopack): `npm run dev`; Build: `npm run build`; Start: `npm start`.

### User Lifecycle & Credits System- Lint/typecheck: `npm run lint`; `npm run typecheck`. CI allows build even with eslint warnings (`next.config.ts`).

1. **Sign-up**: Clerk webhook → `app/api/webhook/route.ts` → creates user in Supabase `users` table with **0 credits**- Database migrations: place `.sql` files in `db/migrations/`; run `npm run migrate` (requires `PG_CONNECTION_STRING` or `DATABASE_URL`). Script: `scripts/run-migrations.js`.

2. **Onboarding**: Users must visit `/decrypt` and solve codekey to unlock **20 credits** (via `app/api/credits/award/route.ts`)- Tests: none configured (`npm test` is a no-op); prefer small runtime checks or route-level validations.

3. **Generation**: Each AI generation costs credits; tracked via `app/api/credits/route.ts`

4. **Credit check pattern**: Always fetch via `GET /api/credits` before generation; returns `{ credits: number, totalGenerated: number }`## Environment variables (must exist where used)

- Clerk: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`.

### Content & Playback Architecture- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `lib/supabase.ts`).

- **Upload**: `uploadToR2(file, bucketName, key)` → returns public R2 URL → save to `combined_media` table- Replicate: `REPLICATE_API_TOKEN`.

- **Playback**: Centralized in `AudioPlayerContext` (`app/contexts/AudioPlayerContext.tsx`)- R2: `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, bucket public bases `NEXT_PUBLIC_R2_AUDIO_URL`/`IMAGES_URL`/`VIDEOS_URL`.

  - Tracks plays after **3 seconds** of listening (prevents spam)- Migrations: `PG_CONNECTION_STRING` or `DATABASE_URL`.

  - Tries `POST /api/media/track-play` first, falls back to `/api/songs/track-play`- Optional: `SENTRY_DSN` or `NEXT_PUBLIC_SENTRY_DSN` (see `lib/sentry.ts`).

  - **Artist plays don't count** (checked via `userId === currentMedia.user_id`)

- **Data table**: `combined_media` stores all content (audio/image/video) with `type` field; legacy `songs` table may exist## Coding conventions and patterns

- API routes: keep handlers small; add CORS for cross-origin use via `lib/cors.ts`:

### Auth & Routing  - For preflight: export `OPTIONS` that returns `handleOptions()`.

- **Public routes**: `/`, `/sign-in`, `/sign-up`, `/api/webhook` (defined in `middleware.ts`)  - Wrap JSON responses with `corsResponse(NextResponse.json(...))`.

- **Protected**: Everything else requires `auth.protect()` via Clerk middleware- Storage: use `uploadToR2(file, bucketName, key)` (see `lib/r2-upload.ts`). Bucket names `audio-files`/`images`/`videos` auto-map to the `NEXT_PUBLIC_R2_*` public URLs.

- **No per-route auth checks**: Security is handled globally; exceptions only for webhooks- Playback: use `useAudioPlayer()` from `app/contexts/AudioPlayerContext.tsx` to set playlist and control transport; it auto-tracks plays after 3s.

- UI/Styling: Tailwind (`tailwind.config.ts`); heavy visuals are lazy-loaded with `React.lazy` to keep TTI fast.

## Development Workflows- Images: `next.config.ts` allows remote images and disables inline scripts for SVG (`contentSecurityPolicy`); prefer external assets.

- Routing/security: rely on `middleware.ts` for route protection rather than per-route checks (except webhook and public paths).

### Commands (PowerShell on Windows)- Headers: `vercel.json` disables API caching; don’t add manual cache on API routes unless you know the tradeoffs.

```powershell

npm run dev          # Dev server with Turbopack## Useful file map (jump here first)

npm run build        # Production build (ignores ESLint warnings)- App entry and layout: `app/layout.tsx`, `app/page.tsx` (home), plus feature pages under `app/**`.

npm run lint         # ESLint (quiet mode)- APIs: `app/api/**`. Examples: webhook (`app/api/webhook/route.ts`), media (`app/api/media/**`), songs (`app/api/songs/**`).

npm run typecheck    # TypeScript validation- Integrations: Supabase (`lib/supabase.ts`), R2 (`lib/r2-upload.ts`), CORS (`lib/cors.ts`), Sentry (`lib/sentry.ts`).

npm run migrate      # Run SQL migrations from db/migrations/- Data/migrations: `db/migrations/**` with runner `scripts/run-migrations.js`.

```- Lyrics utilities: `lib/lyrics-database.ts`, `lib/lyrics-matcher.ts`, `lib/default-lyrics.ts` for generation UI features.



### Database Migrations## Example: minimal CORS-enabled API route

- Place `.sql` files in `db/migrations/` (e.g., `001_add_column.sql`)```ts

- Run via `npm run migrate` (uses `scripts/run-migrations.js`)// app/api/example/route.ts

- Requires `PG_CONNECTION_STRING` or `DATABASE_URL` env varimport { NextResponse } from 'next/server'

- Migrations run in alphabetical order; use numeric prefixesimport { corsResponse, handleOptions } from '@/lib/cors'



### Debuggingexport async function GET() {

- **No tests configured** (`npm test` is a no-op); validate via manual testing or route inspection  return corsResponse(NextResponse.json({ ok: true }))

- Check `app/debug/**` for debug endpoints}

- Logs: Check Vercel deployment logs or local terminal for API errorsexport function OPTIONS() { return handleOptions() }

```

## Coding Patterns & Conventions

If anything above is unclear or feels incomplete (e.g., specific generate/upload endpoints you want to extend), tell me what you’re building and I’ll refine these rules to fit that flow.
### API Routes (Next.js 15 App Router)
**CORS Pattern** (all API routes should support this):
```ts
// app/api/example/route.ts
import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function GET() {
  return corsResponse(NextResponse.json({ data: "value" }))
}
```

**Auth Pattern**:
```ts
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // ... rest of logic
}
```

**Supabase Query Pattern**:
```ts
import { supabase } from '@/lib/supabase'

// Read
const { data, error } = await supabase
  .from('combined_media')
  .select('*')
  .eq('user_id', userId)

// Write
const { error } = await supabase
  .from('combined_media')
  .insert({ field: value })
```

### R2 Upload Pattern
```ts
import { uploadToR2 } from '@/lib/r2-upload'

const result = await uploadToR2(file, 'audio-files', `${uuid}.mp3`)
if (result.success) {
  const publicUrl = result.url // Maps to NEXT_PUBLIC_R2_AUDIO_URL
}
// Bucket → URL mapping: audio-files → AUDIO_URL, images → IMAGES_URL, videos → VIDEOS_URL
```

### Audio Player Integration
```tsx
'use client'
import { useAudioPlayer } from '@/app/contexts/AudioPlayerContext'

function TrackCard({ track }) {
  const { playTrack, setPlaylist } = useAudioPlayer()
  
  return (
    <button onClick={() => {
      setPlaylist([track])  // Or multiple tracks
      playTrack(track)
    }}>
      Play
    </button>
  )
}
```

### AI Generation Pattern (Replicate)
```ts
import Replicate from 'replicate'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!
})

// Music generation
const prediction = await replicate.predictions.create({
  version: "model-version-hash",
  input: { prompt, genre, bpm }
})

// Poll for completion (see app/api/generate/music/route.ts for full pattern)
```

### Prompt Validation (Generation UI)
- **Min**: 3 characters, **Max**: 300 characters
- Character counter with color coding: Red (invalid), Yellow (>270 chars), Gray (valid)
- Pattern in `docs/GENERATION-QUEUE-SYSTEM.md`

### UI/Component Patterns
- **Styling**: Tailwind only; no CSS modules
- **Lazy loading**: Heavy visuals/3D components use `React.lazy(() => import('./Component'))`
- **Modal pattern**: Modals live in `app/components/*Modal.tsx`; controlled via state in parent
- **Icons**: Lucide React (`lucide-react`)

### Lyrics System
- **Database**: 188 curated songs in `lib/lyrics-database.ts` (6 genres: lofi, hiphop, jazz, chill, rnb, techno)
- **Matcher**: `lib/lyrics-matcher.ts` - semantic search for genre/mood-appropriate lyrics
- **Usage**: Import `LYRICS_DATABASE` for random suggestions or `matchLyrics(genre, mood)` for smart matching

## Environment Variables Reference

**Required for Core Functions**:
```env
# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # For server-side admin ops

# Cloudflare R2
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
NEXT_PUBLIC_R2_AUDIO_URL=https://audio.444radio.co.in
NEXT_PUBLIC_R2_IMAGES_URL=https://images.444radio.co.in
NEXT_PUBLIC_R2_VIDEOS_URL=https://videos.444radio.co.in

# Replicate AI
REPLICATE_API_TOKEN=r8_...

# Database Migrations
PG_CONNECTION_STRING=postgresql://user:pass@host:5432/db
# OR
DATABASE_URL=postgresql://...
```

**Optional**:
```env
SENTRY_DSN=https://...  # Error tracking (lib/sentry.ts)
```

## Critical File Map

**Start here for features**:
- Auth flow: `middleware.ts` → `app/api/webhook/route.ts`
- Credits: `app/api/credits/route.ts` + `app/decrypt/page.tsx`
- Generation: `app/api/generate/{music,image,video}/route.ts`
- Upload: `app/api/profile/upload/route.ts` → `lib/r2-upload.ts`
- Playback: `app/contexts/AudioPlayerContext.tsx` → `app/api/media/track-play/route.ts`
- Layout/global: `app/layout.tsx` (wraps with ClerkProvider + AudioPlayerProvider)

**Docs/Reference**:
- `ARCHITECTURE.md` - Product vision & database schema
- `docs/GENERATION-QUEUE-SYSTEM.md` - Queue architecture & prompt validation
- `docs/SMART-LYRICS-MATCHING.md` - Lyrics system details

**Config**:
- `next.config.ts` - Allows remote images, ignores ESLint in builds
- `vercel.json` - Disables API caching (`Cache-Control: no-cache`)
- `tailwind.config.ts` - Design tokens

## Common Gotchas

1. **API Caching**: `vercel.json` disables caching for all `/api/*` routes; don't add `Cache-Control` headers unless intentional
2. **TypeScript Build**: `ignoreBuildErrors: false` in `next.config.ts` - build will fail on TS errors (unlike ESLint)
3. **Credits Race**: If webhook hasn't synced user yet, `GET /api/credits` creates user with 0 credits (not 20)
4. **Supabase Tables**: `combined_media` is the primary table; legacy `songs` table may exist for backwards compat
5. **Play Tracking**: Only counts after 3s + excludes artist's own plays (check `userId` match)
6. **R2 Bucket Names**: Must exactly match `audio-files`/`images`/`videos` for URL mapping to work

## When Adding Features

**New API endpoint?** 
1. Add CORS via `corsResponse()` + `OPTIONS` handler
2. Add auth check via `auth()` from `@clerk/nextjs/server`
3. Consider if it needs credits deduction (see `/api/credits/route.ts` pattern)

**New generation type?**
1. Copy pattern from `app/api/generate/music/route.ts`
2. Update credits cost in `app/api/credits/route.ts`
3. Add to generation modal UI (`app/components/*GenerationModal.tsx`)

**New page?**
1. Create under `app/[route]/page.tsx`
2. Add to `middleware.ts` if should be public
3. Wrap client components with `'use client'` directive

**Database change?**
1. Create `db/migrations/00X_description.sql`
2. Run `npm run migrate` locally
3. Deploy - Vercel build will auto-run migrations if `PG_CONNECTION_STRING` set

## Deployment & Error Handling

### Vercel Deployment Flow
1. Push to `master` branch → auto-deploys to production
2. Environment variables set in Vercel dashboard
3. Build logs available at vercel.com/[project]/deployments
4. Migrations run automatically if `PG_CONNECTION_STRING` is set

### Common Deployment Issues
- **Build fails on TypeScript errors**: Check `npm run typecheck` locally first
- **API routes return 500**: Check environment variables are set in Vercel
- **Database connection fails**: Verify `PG_CONNECTION_STRING` or `DATABASE_URL` format
- **R2 uploads fail**: Confirm all R2 env vars including bucket URLs are correct

### Error Tracking Pattern (Sentry)
```ts
import { captureException } from '@/lib/sentry'

try {
  // risky operation
} catch (error) {
  console.error('Context for logs:', error)
  captureException(error) // Send to Sentry if configured
  return NextResponse.json({ error: 'User-friendly message' }, { status: 500 })
}
```

### API Response Conventions
- **Success**: `{ success: true, data: {...} }` or just `{ field: value }`
- **Error**: `{ error: "Human-readable message" }` with appropriate status code
- **Credits**: `{ credits: number, totalGenerated: number }`
- **Pagination**: `{ data: [...], page: number, total: number }`

## Performance Patterns

### Client-Side Optimization
- **Heavy components**: Lazy-load with `React.lazy()` (see `app/test-3d/page.tsx` for 3D components)
- **Images**: Use Next.js `<Image>` component for automatic optimization (already configured for remote patterns)
- **Audio streaming**: R2 URLs are CDN-backed; no need for server-side streaming

### Server-Side Best Practices
- **Supabase queries**: Use `.select()` with specific fields to reduce payload
- **R2 uploads**: File size limits enforced at form level; consider adding server-side validation
- **Replicate polling**: Default 60-second timeout; adjust based on model (see `app/api/generate/music/route.ts`)

## Security Considerations

### Already Implemented
- **CORS**: Enabled on all API routes via `lib/cors.ts` (allows all origins)
- **Auth**: Global middleware protection; no need for per-route checks
- **Webhook verification**: Svix signature validation in `app/api/webhook/route.ts`
- **Service role key**: Used server-side only (never exposed to client)

### When Adding Sensitive Operations
- Use `SUPABASE_SERVICE_ROLE_KEY` for admin operations (bypasses RLS)
- Never expose service keys in client components
- Validate user ownership before updates/deletes: `eq('user_id', userId)`
- Rate limiting: Not implemented; consider for generation endpoints if abuse occurs

## Generation System Details

### Music Generation Flow
1. User submits prompt → validate (3-300 chars)
2. Check credits via `GET /api/credits`
3. POST to `/api/generate/music` with `{ prompt, genre, bpm, lyrics }`
4. Replicate creates prediction → poll until complete (60s timeout)
5. Download audio from Replicate URL → upload to R2
6. Save to `combined_media` with `type: 'audio'`
7. Deduct credits via `POST /api/credits` (not implemented in example; handle in generation endpoint)

### Queue System (Client-Side)
- Multiple generations can run simultaneously
- Each gets unique `messageId` for tracking
- UI shows "Queued" → "Generating" → "Complete"
- Pattern in `docs/GENERATION-QUEUE-SYSTEM.md`

### Generation Costs (Typical)
- Music: 5-10 credits (adjust in logic)
- Cover art: 2-3 credits
- Video: 10-15 credits (if implemented)

## Useful Terminal Commands

### Development
```powershell
npm run dev                           # Start dev server
npm run build                         # Test production build
npm run lint                          # Check for lint errors
npm run typecheck                     # Verify TypeScript
```

### Database Operations
```powershell
npm run migrate                       # Run all migrations
$env:PG_CONNECTION_STRING = "postgresql://..." ; npm run migrate  # Set env and run
```

### Debugging
```powershell
# Check environment variables (never commit real values!)
echo $env:NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

# View recent git changes
git log --oneline -10

# Check for uncommitted changes
git status
```

### Supabase Queries (via psql or Supabase dashboard)
```sql
-- Check user credits
SELECT clerk_user_id, credits, total_generated FROM users WHERE clerk_user_id = 'user_xxx';

-- Count content by type
SELECT type, COUNT(*) FROM combined_media GROUP BY type;

-- Recent uploads
SELECT id, title, created_at, plays FROM combined_media ORDER BY created_at DESC LIMIT 10;
```

## Component Organization

### Modal Pattern (Standardized)
All modals follow this pattern:
```tsx
// app/components/ExampleModal.tsx
'use client'

interface ExampleModalProps {
  isOpen: boolean
  onClose: () => void
  // ... other props
}

export default function ExampleModal({ isOpen, onClose }: ExampleModalProps) {
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 p-8 rounded-lg max-w-2xl w-full">
        {/* Modal content */}
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
```

### Page Structure
```tsx
// app/[feature]/page.tsx
'use client'  // If using hooks/state
import { useUser } from '@clerk/nextjs'
import { useAudioPlayer } from '@/app/contexts/AudioPlayerContext'

export default function FeaturePage() {
  const { user } = useUser()
  const { playTrack } = useAudioPlayer()
  
  // Fetch data in useEffect or React Query
  // Render UI
}
```

## Quick Reference: File Locations

### Need to add a new...?
- **API endpoint**: `app/api/[feature]/route.ts`
- **Page**: `app/[route]/page.tsx`
- **Modal**: `app/components/[Feature]Modal.tsx`
- **Utility function**: `lib/[feature].ts`
- **Database migration**: `db/migrations/00X_description.sql`
- **Type definition**: `types/[feature].ts` (if needed; prefer inline types)

### Key integration files
- **Clerk setup**: `app/layout.tsx` (ClerkProvider wrapper)
- **Audio player**: `app/contexts/AudioPlayerContext.tsx` (global state)
- **Middleware**: `middleware.ts` (auth protection)
- **CORS helper**: `lib/cors.ts` (all API routes)
- **R2 uploads**: `lib/r2-upload.ts` (file storage)
- **Supabase client**: `lib/supabase.ts` (database queries)

## Testing Strategies (Manual)

### Local Testing Checklist
- [ ] Auth flow: Sign up → redirects correctly → webhook creates user
- [ ] Credits: New user has 0 credits → visit `/decrypt` → solve puzzle → gets 20 credits
- [ ] Generation: Submit prompt → deducts credits → creates content → saves to DB
- [ ] Upload: File → R2 → public URL accessible → saved to `combined_media`
- [ ] Playback: Click play → audio loads → plays for 3s → increments play count
- [ ] Profile: View own profile → shows content → edit modal works

### Common Test URLs
- `/` - Homepage (public)
- `/sign-in` - Clerk sign-in (public)
- `/decrypt` - Credit unlock puzzle (protected)
- `/create` - Generation interface (protected)
- `/radio` - Browse all content (protected)
- `/profile/[userId]` - User profile (protected)
- `/api/credits` - Check user credits (protected)
- `/api/debug` - Debug endpoints (protected; check folder)

## Troubleshooting Guide

### "User not found" errors
- **Cause**: Webhook hasn't synced yet or failed
- **Fix**: Check Clerk webhook logs; `GET /api/credits` creates user as fallback

### Play count not incrementing
- **Check**: Is user the artist? (Artists don't count)
- **Check**: Did audio play for 3+ seconds?
- **Check**: Is `userId` being passed to track-play endpoint?

### R2 upload returns undefined URL
- **Check**: Bucket name exactly matches `audio-files`, `images`, or `videos`
- **Check**: All R2 env vars set (endpoint, keys, public URLs)
- **Check**: File size within limits (no server-side limit configured)

### Generation stuck in "Generating"
- **Check**: Replicate API token valid
- **Check**: Model version hash correct in `app/api/generate/[type]/route.ts`
- **Check**: Timeout not exceeded (default 60s)
- **Check**: Network issues or Replicate service status

### Clerk webhook not triggering
- **Check**: `CLERK_WEBHOOK_SECRET` matches Clerk dashboard
- **Check**: Webhook URL is `https://yourdomain.com/api/webhook`
- **Check**: Webhook is active in Clerk dashboard
- **Test**: Use Clerk's "Send test event" feature
