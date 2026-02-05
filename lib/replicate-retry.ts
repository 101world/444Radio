/**
 * Replicate API retry utility with exponential backoff
 * Handles 429 rate limit errors gracefully
 */

interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
}

interface ReplicateError extends Error {
  response?: {
    status: number
    data?: any
    headers?: any
  }
}

/**
 * Extract retry_after from Replicate 429 error
 */
function extractRetryAfter(error: any): number | null {
  try {
    // Check error message for retry_after value
    const errorMessage = error?.message || String(error)
    const retryMatch = errorMessage.match(/"retry_after":(\d+)/)
    if (retryMatch) {
      return parseInt(retryMatch[1], 10)
    }

    // Check response headers
    if (error?.response?.headers?.['retry-after']) {
      return parseInt(error.response.headers['retry-after'], 10)
    }

    // Check ratelimit-reset header
    if (error?.response?.headers?.['ratelimit-reset']) {
      return parseInt(error.response.headers['ratelimit-reset'], 10)
    }
  } catch (e) {
    console.warn('Failed to extract retry_after:', e)
  }
  return null
}

/**
 * Check if error is a 429 rate limit error
 */
function isRateLimitError(error: any): boolean {
  const errorMessage = error?.message || String(error)
  return (
    errorMessage.includes('429') ||
    errorMessage.includes('Too Many Requests') ||
    errorMessage.includes('throttled') ||
    errorMessage.includes('rate limit')
  )
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry a Replicate API call with exponential backoff
 * Respects retry_after header from 429 responses
 */
export async function replicateRunWithRetry<T = any>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000
  } = options

  let lastError: any
  let attempt = 0

  while (attempt <= maxRetries) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      attempt++

      // Don't retry on non-rate-limit errors
      if (!isRateLimitError(error)) {
        throw error
      }

      // Don't retry after max attempts
      if (attempt > maxRetries) {
        console.error(`❌ Max retries (${maxRetries}) exceeded for Replicate API`)
        throw error
      }

      // Calculate delay
      let delayMs = initialDelayMs * Math.pow(2, attempt - 1)
      
      // Use retry_after from API if available (in seconds, convert to ms)
      const retryAfterSec = extractRetryAfter(error)
      if (retryAfterSec !== null) {
        delayMs = (retryAfterSec + 1) * 1000 // Add 1 second buffer
        console.log(`⏳ Replicate rate limit hit. API says retry after ${retryAfterSec}s`)
      }

      // Cap at max delay
      delayMs = Math.min(delayMs, maxDelayMs)

      console.log(`⏳ Retry attempt ${attempt}/${maxRetries} after ${delayMs}ms...`)
      await sleep(delayMs)
    }
  }

  throw lastError
}

/**
 * Sanitize error messages to hide technical details from users
 */
export function sanitizeReplicateError(error: any): string {
  const errorStr = error instanceof Error ? error.message : String(error)
  
  // Hide all technical details - users should only see generic message
  if (errorStr.includes('429') || 
      errorStr.includes('rate limit') || 
      errorStr.includes('throttled')) {
    return '444 radio is locking in, please try again in a few minutes'
  }
  
  if (errorStr.includes('replicate') ||
      errorStr.includes('supabase') ||
      errorStr.includes('cloudflare') ||
      errorStr.includes('vercel') ||
      errorStr.includes('API') ||
      errorStr.includes('prediction') ||
      errorStr.includes('status') ||
      errorStr.includes('failed with')) {
    return '444 radio is locking in, please try again in a few minutes'
  }
  
  // Generic fallback for any other technical errors
  return '444 radio is locking in, please try again in a few minutes'
}
