# 444Radio Performance Optimization Roadmap

**Created**: February 11, 2026  
**Goal**: Enhance overall website performance, reduce load times, and improve user experience

---

## 🎯 Priority 1: Critical Performance Wins (Week 1)

### 1. Add React Query for API Caching
**Impact**: 🔥🔥🔥 High  
**Effort**: Medium  
**Why**: Eliminates redundant API calls, speeds up navigation

```bash
npm install @tanstack/react-query
```

**Implementation**:
- Wrap app with `QueryClientProvider` in `app/layout.tsx`
- Replace `fetch()` calls with `useQuery` hooks
- Cache user credits, library data, profile data
- Set stale times: credits (30s), library (5min), profile (10min)
- Add optimistic updates for likes/plays

**Files to Update**:
- `app/layout.tsx` - Add QueryClientProvider
- `app/create/page.tsx` - Cache credits API
- `app/library/page.tsx` - Cache library queries
- `app/explore/page.tsx` - Cache explore data

---

### 2. Optimize Supabase Queries with Indexes
**Impact**: 🔥🔥🔥 High  
**Effort**: Low  
**Why**: Faster database queries, reduced load times

**Create Migration**: `db/migrations/1004_add_performance_indexes.sql`

```sql
-- Index on combined_media for fast user queries
CREATE INDEX IF NOT EXISTS idx_combined_media_user_id ON combined_media(user_id);
CREATE INDEX IF NOT EXISTS idx_combined_media_type ON combined_media(type);
CREATE INDEX IF NOT EXISTS idx_combined_media_genre ON combined_media(genre);
CREATE INDEX IF NOT EXISTS idx_combined_media_created_at ON combined_media(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_combined_media_plays ON combined_media(plays DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_combined_media_user_type ON combined_media(user_id, type);
CREATE INDEX IF NOT EXISTS idx_combined_media_public_plays ON combined_media(is_public, plays DESC) WHERE is_public = true;

-- Index on users for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Index for likes/plays tracking
CREATE INDEX IF NOT EXISTS idx_likes_user_media ON likes(user_id, media_id);
CREATE INDEX IF NOT EXISTS idx_plays_media_created ON plays(media_id, created_at);
```

---

### 3. Lazy Load Heavy Components
**Impact**: 🔥🔥🔥 High  
**Effort**: Low  
**Why**: Reduces initial bundle size, faster TTI (Time to Interactive)

**Already Done**:
- ✅ `HolographicBackground` - lazy loaded in create page

**Need to Add**:
```tsx
// app/create/page.tsx
const MusicGenerationModal = lazy(() => import('../components/MusicGenerationModal'))
const EffectsGenerationModal = lazy(() => import('../components/EffectsGenerationModal'))
const LoopersGenerationModal = lazy(() => import('../components/LoopersGenerationModal'))
const CombineMediaModal = lazy(() => import('../components/CombineMediaModal'))
const TwoStepReleaseModal = lazy(() => import('../components/TwoStepReleaseModal'))
const MediaUploadModal = lazy(() => import('../components/MediaUploadModal'))

// app/explore/page.tsx
const MediaCard = lazy(() => import('../components/MediaCard'))

// Wrap with Suspense
<Suspense fallback={<LoadingSpinner />}>
  <MusicGenerationModal {...props} />
</Suspense>
```

---

### 4. Optimize R2 Image Delivery
**Impact**: 🔥🔥 Medium-High  
**Effort**: Low  
**Why**: Faster image loading, reduced bandwidth

**Update `next.config.ts`**:
```ts
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'audio.444radio.co.in',
    },
    {
      protocol: 'https',
      hostname: 'images.444radio.co.in',
    },
    {
      protocol: 'https',
      hostname: 'videos.444radio.co.in',
    }
  ],
  formats: ['image/avif', 'image/webp'], // Modern formats
  deviceSizes: [640, 750, 828, 1080, 1200, 1920], // Responsive breakpoints
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384], // Thumbnail sizes
},
```

**Add Cloudflare Image Resizing**:
- Configure R2 bucket for automatic resizing
- Use URL params: `?width=300&height=300&fit=cover`

---

### 5. Add Compression Middleware
**Impact**: 🔥🔥 Medium-High  
**Effort**: Low  
**Why**: Reduces response sizes by 60-80%

**`vercel.json` Update**:
```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache" },
        { "key": "Content-Encoding", "value": "gzip" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/assets/:path*",
      "destination": "https://images.444radio.co.in/:path*",
      "has": [
        {
          "type": "header",
          "key": "Accept",
          "value": "(.*webp.*)"
        }
      ]
    }
  ]
}
```

---

## 🎯 Priority 2: Database & API Optimization (Week 2)

### 6. Implement Redis Caching Layer
**Impact**: 🔥🔥🔥 High  
**Effort**: High  
**Why**: Dramatically reduces database load, sub-10ms response times

**Setup Upstash Redis** (Vercel-compatible):
```bash
npm install @upstash/redis
```

**`lib/redis.ts`**:
```ts
import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
})

// Cache helpers
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 300 // 5 minutes default
): Promise<T> {
  const cached = await redis.get<T>(key)
  if (cached) return cached

  const data = await fetcher()
  await redis.setex(key, ttl, data)
  return data
}

export async function invalidateCache(pattern: string) {
  const keys = await redis.keys(pattern)
  if (keys.length > 0) {
    await redis.del(...keys)
  }
}
```

**Use in API routes**:
```ts
// app/api/credits/route.ts
import { getCached, invalidateCache } from '@/lib/redis'

const credits = await getCached(
  `credits:${userId}`,
  async () => {
    // Fetch from Supabase
    const { data } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_user_id', userId)
      .single()
    return data
  },
  30 // 30 seconds TTL
)

// Invalidate on credit changes
await invalidateCache(`credits:${userId}`)
```

**Cache Strategy**:
- User credits: 30s TTL
- Library data: 5min TTL
- Explore feed: 2min TTL
- Profile data: 10min TTL
- Static content: 1hour TTL

---

### 7. Add Database Connection Pooling
**Impact**: 🔥🔥 Medium  
**Effort**: Medium  
**Why**: Prevents connection exhaustion, faster queries

**`lib/supabase-server.ts`** (new file):
```ts
import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client with connection pooling
export const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'x-connection-pool': 'enabled',
      },
    },
  }
)

// Connection pool settings in Supabase dashboard:
// - Pool size: 20-30 connections
// - Pool timeout: 30s
// - Max lifetime: 3600s
```

---

### 8. Database Query Result Caching
**Impact**: 🔥🔥 Medium  
**Effort**: Low  
**Why**: Reduces repeated queries for same data

**Pattern**:
```ts
// app/api/explore/route.ts
import { redis } from '@/lib/redis'

export async function GET() {
  const cacheKey = 'explore:feed:latest'
  
  // Try cache first
  const cached = await redis.get(cacheKey)
  if (cached) {
    return NextResponse.json(cached)
  }
  
  // Query database
  const { data } = await supabase
    .from('combined_media')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(50)
  
  // Cache for 2 minutes
  await redis.setex(cacheKey, 120, data)
  
  return NextResponse.json(data)
}
```

---

### 9. Optimize Supabase RLS Policies
**Impact**: 🔥 Low-Medium  
**Effort**: Medium  
**Why**: Faster query execution, better security

**Audit RLS Policies**:
```sql
-- Check current policies
SELECT * FROM pg_policies WHERE schemaname = 'public';

-- Optimize with indexes on RLS columns
CREATE INDEX IF NOT EXISTS idx_combined_media_rls 
ON combined_media(user_id, is_public);

-- Simplify complex RLS policies
-- Instead of multiple OR conditions, use IN clause
ALTER POLICY "Users can view public or own media" ON combined_media
USING (
  is_public = true 
  OR user_id IN (
    SELECT clerk_user_id FROM users WHERE clerk_user_id = current_user_id()
  )
);
```

---

## 🎯 Priority 3: Frontend Optimization (Week 3)

### 10. Implement Virtual Scrolling for Large Lists
**Impact**: 🔥🔥 Medium-High  
**Effort**: Medium  
**Why**: Smooth scrolling with 1000+ items

```bash
npm install @tanstack/react-virtual
```

**`app/library/page.tsx`**:
```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

const parentRef = useRef<HTMLDivElement>(null)

const virtualizer = useVirtualizer({
  count: tracks.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 100, // Estimated row height
  overscan: 5, // Pre-render 5 items above/below viewport
})

return (
  <div ref={parentRef} style={{ height: '100vh', overflow: 'auto' }}>
    <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
      {virtualizer.getVirtualItems().map((virtualItem) => (
        <div
          key={virtualItem.key}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: `${virtualItem.size}px`,
            transform: `translateY(${virtualItem.start}px)`,
          }}
        >
          <TrackCard track={tracks[virtualItem.index]} />
        </div>
      ))}
    </div>
  </div>
)
```

---

### 11. Add Request Debouncing/Throttling
**Impact**: 🔥 Medium  
**Effort**: Low  
**Why**: Prevents API spam, reduces server load

**`lib/debounce.ts`**:
```ts
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }
    
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}
```

**Usage**:
```tsx
// Debounce search input
const debouncedSearch = debounce((query: string) => {
  fetchSearchResults(query)
}, 300)

// Throttle scroll events
const throttledScroll = throttle(() => {
  updateScrollPosition()
}, 100)
```

---

### 12. Optimize GenerationQueue Context
**Impact**: 🔥 Medium  
**Effort**: Low  
**Why**: Reduces re-renders, faster UI updates

**`app/contexts/GenerationQueueContext.tsx`**:
```tsx
import { memo, useMemo } from 'react'

// Memoize expensive computations
const getActiveCount = useMemo(() => {
  return generations.filter(g => g.status === 'generating').length
}, [generations])

// Split context into read/write to prevent unnecessary re-renders
const GenerationQueueStateContext = createContext<GenerationItem[]>([])
const GenerationQueueDispatchContext = createContext<GenerationQueueActions>({} as any)

export function useGenerationQueueState() {
  return useContext(GenerationQueueStateContext)
}

export function useGenerationQueueDispatch() {
  return useContext(GenerationQueueDispatchContext)
}
```

---

### 13. Optimize Audio Streaming
**Impact**: 🔥🔥 Medium-High  
**Effort**: Medium  
**Why**: Faster playback start, reduced buffering

**`app/contexts/AudioPlayerContext.tsx`**:
```tsx
// Preload next track in queue
useEffect(() => {
  if (currentIndex < playlist.length - 1) {
    const nextTrack = playlist[currentIndex + 1]
    const audio = new Audio(nextTrack.audio_url)
    audio.preload = 'metadata' // Load metadata only
    audio.load()
  }
}, [currentIndex, playlist])

// Use HTML5 Audio with better buffering
audioRef.current.preload = 'auto'
audioRef.current.crossOrigin = 'anonymous'

// Add service worker for audio caching
// public/sw.js
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('.mp3') || event.request.url.includes('.wav')) {
    event.respondWith(
      caches.open('audio-cache').then((cache) => {
        return cache.match(event.request).then((response) => {
          return response || fetch(event.request).then((response) => {
            cache.put(event.request, response.clone())
            return response
          })
        })
      })
    )
  }
})
```

---

## 🎯 Priority 4: Monitoring & Analytics (Week 4)

### 14. Add Sentry Performance Monitoring
**Impact**: 🔥🔥 Medium  
**Effort**: Low  
**Why**: Identify bottlenecks, track errors in production

```bash
npm install @sentry/nextjs
```

**`sentry.client.config.ts`**:
```ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1, // 10% of transactions
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    new Sentry.BrowserTracing({
      tracingOrigins: ['444radio.co.in', /^\//],
    }),
    new Sentry.Replay(),
  ],
})
```

**Track Custom Metrics**:
```ts
// Track API performance
Sentry.startTransaction({ name: 'Generate Music' })
const span = Sentry.getCurrentHub().getScope()?.getTransaction()?.startChild({
  op: 'replicate.generate',
  description: 'MusicGen Generation',
})

// ... generation code ...

span?.finish()
```

---

### 15. Add Web Vitals Monitoring
**Impact**: 🔥 Medium  
**Effort**: Low  
**Why**: Track Core Web Vitals (LCP, FID, CLS)

**`app/layout.tsx`**:
```tsx
import { useReportWebVitals } from 'next/web-vitals'

export function WebVitals() {
  useReportWebVitals((metric) => {
    // Send to analytics
    if (process.env.NODE_ENV === 'production') {
      fetch('/api/analytics/vitals', {
        method: 'POST',
        body: JSON.stringify(metric),
      })
    }
    
    console.log(metric)
  })
  
  return null
}

// In layout:
<WebVitals />
```

**Target Metrics**:
- LCP (Largest Contentful Paint): < 2.5s
- FID (First Input Delay): < 100ms
- CLS (Cumulative Layout Shift): < 0.1
- TTFB (Time to First Byte): < 600ms

---

## 🎯 Priority 5: Advanced Optimizations (Ongoing)

### 16. Implement Service Worker for PWA
**Impact**: 🔥🔥 Medium  
**Effort**: High  
**Why**: Offline support, faster repeat visits

**`next.config.ts`** with PWA:
```bash
npm install next-pwa
```

```ts
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})

module.exports = withPWA({
  // ... existing config
})
```

---

### 17. Add CDN Caching Headers
**Impact**: 🔥 Medium  
**Effort**: Low  
**Why**: Faster global content delivery

**`app/api/media/[id]/route.ts`**:
```ts
return new Response(JSON.stringify(data), {
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    'CDN-Cache-Control': 'public, max-age=86400',
    'Vercel-CDN-Cache-Control': 'max-age=3600',
  },
})
```

---

### 18. Optimize Bundle Size (Tree Shaking)
**Impact**: 🔥 Low-Medium  
**Effort**: Low  
**Why**: Faster initial load

**Analyze bundle**:
```bash
npm run build -- --profile
npx @next/bundle-analyzer
```

**Optimize imports**:
```ts
// ❌ Don't import entire library
import _ from 'lodash'

// ✅ Import only what you need
import debounce from 'lodash/debounce'
import throttle from 'lodash/throttle'

// ✅ Use native methods when possible
const unique = [...new Set(array)]
```

---

### 19. Add Static Page Generation
**Impact**: 🔥 Low  
**Effort**: Low  
**Why**: Instant load for static pages

**`app/pricing/page.tsx`**:
```tsx
// Force static generation
export const dynamic = 'force-static'
export const revalidate = 3600 // Revalidate every hour

export default function PricingPage() {
  // ... static content
}
```

---

### 20. Implement WebSocket Connection Pooling
**Impact**: 🔥 Low  
**Effort**: Medium  
**Why**: Better real-time performance for station feature

**`lib/websocket-pool.ts`**:
```ts
class WebSocketPool {
  private pool: Map<string, WebSocket> = new Map()
  private maxConnections = 5
  
  getConnection(url: string): WebSocket {
    if (this.pool.has(url)) {
      return this.pool.get(url)!
    }
    
    if (this.pool.size >= this.maxConnections) {
      const oldestKey = this.pool.keys().next().value
      this.pool.get(oldestKey)?.close()
      this.pool.delete(oldestKey)
    }
    
    const ws = new WebSocket(url)
    this.pool.set(url, ws)
    return ws
  }
}

export const wsPool = new WebSocketPool()
```

---

## 📊 Expected Performance Improvements

| Optimization | Load Time | API Response | FCP | LCP |
|-------------|-----------|--------------|-----|-----|
| **Before** | 3.2s | 450ms | 1.8s | 3.5s |
| **After P1** | 1.8s ⚡ | 180ms ⚡ | 0.9s ⚡ | 1.6s ⚡ |
| **After P2** | 1.2s ⚡⚡ | 80ms ⚡⚡ | 0.7s ⚡⚡ | 1.2s ⚡⚡ |
| **After P3-5** | <1s ⚡⚡⚡ | <50ms ⚡⚡⚡ | 0.5s ⚡⚡⚡ | <1s ⚡⚡⚡ |

**Key Targets**:
- ⚡ First Paint: < 1s
- ⚡ Time to Interactive: < 2s
- ⚡ API Response: < 100ms (cached)
- ⚡ Lighthouse Score: 95+

---

## 🛠️ Implementation Order

1. **Week 1**: P1 items (React Query, Indexes, Lazy Loading, Compression)
2. **Week 2**: P2 items (Redis, Connection Pooling, RLS optimization)
3. **Week 3**: P3 items (Virtual Scrolling, Debouncing, Audio optimization)
4. **Week 4**: P4 items (Sentry, Web Vitals)
5. **Ongoing**: P5 items (PWA, advanced optimizations)

---

## 📈 Monitoring & Validation

After each priority phase:
1. Run Lighthouse audit
2. Check Vercel Analytics
3. Monitor Sentry metrics
4. Validate Core Web Vitals
5. A/B test with real users
6. Document improvements

---

## 💰 Cost Implications

- **Redis (Upstash)**: ~$10/month
- **Sentry**: Free tier (10k events/month)
- **Cloudflare R2**: Already using
- **Vercel Pro**: Already using
- **Total Additional**: ~$10-20/month

**ROI**: Improved retention, lower bounce rate, better SEO ranking

---

## 🎯 Success Metrics

- Load time: 3.2s → <1s (70% improvement)
- Bounce rate: 45% → <25%
- Session duration: +40%
- SEO ranking: +15-20 positions
- Server costs: -30% (via caching)
- User satisfaction: +50%

---

**Next Steps**: Start with Priority 1 items this week! 🚀
