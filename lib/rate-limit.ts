/**
 * 444Radio - Rate Limiting Implementation
 * 
 * CRITICAL: This must be implemented before scaling to 1M users
 * 
 * Setup:
 * 1. Create Upstash Redis account: https://upstash.com
 * 2. Create a Redis database (free tier is fine to start)
 * 3. Copy connection details to .env.local:
 *    UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
 *    UPSTASH_REDIS_REST_TOKEN=your-token-here
 * 4. Install dependencies: npm install @upstash/ratelimit @upstash/redis
 * 5. Import this file in your API routes
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Check if Redis credentials are configured
const isConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && 
  process.env.UPSTASH_REDIS_REST_TOKEN
)

// Initialize Redis connection (only if configured)
const redis = isConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

/**
 * Rate limiter for AI generation endpoints
 * Limit: 10 requests per minute per user
 * Use: /api/generate/music, /api/generate/image, etc.
 */
export const generationLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
      prefix: '444radio:ratelimit:generation',
    })
  : null

/**
 * Rate limiter for credit operations
 * Limit: 20 requests per minute per user
 * Use: /api/credits/**, /api/wallet/**
 */
export const creditLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '1 m'),
      analytics: true,
      prefix: '444radio:ratelimit:credits',
    })
  : null

/**
 * Rate limiter for upload endpoints
 * Limit: 5 uploads per minute per user
 * Use: /api/upload/**, /api/profile/upload
 */
export const uploadLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      analytics: true,
      prefix: '444radio:ratelimit:upload',
    })
  : null

/**
 * Rate limiter for general API endpoints
 * Limit: 100 requests per minute per user
 * Use: All other API routes
 */
export const apiLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      analytics: true,
      prefix: '444radio:ratelimit:api',
    })
  : null

/**
 * Rate limiter for public endpoints (by IP)
 * Limit: 30 requests per minute per IP
 * Use: /api/explore, /api/search, etc.
 */
export const publicLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '1 m'),
      analytics: true,
      prefix: '444radio:ratelimit:public',
    })
  : null

/**
 * Helper function to check rate limit and return standardized response
 * 
 * @example
 * ```typescript
 * import { checkRateLimit, generationLimiter } from '@/lib/rate-limit'
 * 
 * export async function POST(req: NextRequest) {
 *   const { userId } = await auth()
 *   
 *   const rateLimitResult = await checkRateLimit(generationLimiter, userId!)
 *   if (rateLimitResult) return rateLimitResult // Returns 429 response
 *   
 *   // ... rest of your code
 * }
 * ```
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<Response | null> {
  // Skip rate limiting if not configured (dev mode)
  if (!limiter) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  Rate limiting not configured - add UPSTASH_REDIS_* env vars')
    }
    return null
  }

  const { success, limit, reset, remaining } = await limiter.limit(identifier)

  if (!success) {
    const retryAfterSeconds = Math.ceil((reset - Date.now()) / 1000)
    
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        message: `Too many requests. Please try again in ${retryAfterSeconds} seconds.`,
        retryAfter: retryAfterSeconds,
        limit,
        remaining,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
          'Retry-After': retryAfterSeconds.toString(),
        },
      }
    )
  }

  return null
}

/**
 * Get identifier from request (userId or IP address)
 */
export function getRateLimitIdentifier(
  req: Request, 
  userId?: string | null
): string {
  // Use userId if available (authenticated requests)
  if (userId) return userId

  // Fall back to IP address for public endpoints
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  
  return `ip:${ip}`
}

/**
 * EXAMPLE USAGE IN API ROUTE:
 * 
 * // app/api/generate/music/route.ts
 * import { auth } from '@clerk/nextjs/server'
 * import { checkRateLimit, generationLimiter } from '@/lib/rate-limit'
 * 
 * export async function POST(req: NextRequest) {
 *   const { userId } = await auth()
 *   if (!userId) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 *   }
 * 
 *   // Rate limit check
 *   const rateLimitResult = await checkRateLimit(generationLimiter, userId)
 *   if (rateLimitResult) return rateLimitResult
 * 
 *   // ... rest of generation logic
 * }
 */

// Warning if not configured
if (!isConfigured && process.env.NODE_ENV === 'production') {
  console.error(
    '🚨 CRITICAL: Rate limiting is not configured in production!\n' +
    '   Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to environment variables.\n' +
    '   See: https://upstash.com'
  )
}
