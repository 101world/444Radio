/**
 * Error Sanitizer — NEVER expose internal service names or error details to users.
 * 
 * All API routes MUST use sanitizeError() before returning error messages.
 * 
 * Internal service names that must NEVER appear in user-facing responses:
 * - Replicate, Cloudflare, Supabase, PostgreSQL, R2, Vercel, Clerk, Svix, etc.
 * 
 * The standard user-facing error message is:
 * "444 Radio locking in. Please try again."
 */

const SAFE_MESSAGE = '444 Radio locking in. Please try again.'

/** Internal keywords that must never reach the user */
const BLOCKED_PATTERNS = [
  /replicate/i,
  /cloudflare/i,
  /supabase/i,
  /postgres/i,
  /r2[\s_\-.]|r2$/i,
  /vercel/i,
  /clerk/i,
  /svix/i,
  /openai/i,
  /aws/i,
  /s3[\s_\-.]|s3$/i,
  /firebase/i,
  /director:/i,           // Replicate internal "Director:" errors
  /prediction/i,
  /api\.replicate/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /ETIMEDOUT/i,
  /socket hang up/i,
  /getaddrinfo/i,
  /status:\s*\d{3}/i,     // "status: 500" etc.
  /HTTP\s+\d{3}/i,        // "HTTP 502"
  /Bad Gateway/i,
  /Internal Server Error/i,
  /stack trace/i,
  /at\s+\w+\.\w+\s*\(/i,  // stack trace lines: "at Module.run ("
  /\.js:\d+:\d+/i,         // file:line:col in stack traces
  /\.ts:\d+:\d+/i,
  /node_modules/i,
  /json\.parse/i,
  /unexpected token/i,
  /FATAL/i,
  /GPU/i,
  /CUDA/i,
  /OOM/i,
  /out of memory/i,
  /model.*version/i,
  /webhook/i,
  /service.role/i,
  /Bearer /i,
  /apikey/i,
  /Authorization/i,
  /\.co\.in/i,             // our R2 domain
  /\.supabase\./i,
  /cloudflarestorage/i,
]

/**
 * Sanitize any error before returning to a user.
 * 
 * Always logs the real error to console (server-side only),
 * but NEVER returns it to the client.
 * 
 * @param error  The raw error (string, Error, or unknown)
 * @param context Optional context string for server logs (e.g., "Audio Boost")
 * @returns A safe, user-facing error message
 */
export function sanitizeError(error: unknown, context?: string): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')

  // Log internally for debugging (server-side only, never reaches client)
  if (context) {
    console.error(`[${context}] Internal error:`, raw)
  }

  // If the raw error contains ANY blocked pattern, return the safe message
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(raw)) {
      return SAFE_MESSAGE
    }
  }

  // Even if no pattern matched, if it looks like a technical error
  // (contains colons, braces, brackets, or exceeds 120 chars), block it
  if (
    raw.includes('{') ||
    raw.includes('}') ||
    raw.includes('[') && raw.includes(']') ||
    raw.length > 120
  ) {
    return SAFE_MESSAGE
  }

  // Return safe message by default — we never trust raw errors
  return SAFE_MESSAGE
}

/**
 * Sanitize credit-related error messages from Supabase RPC.
 * Only allows through a very small set of known-safe credit messages.
 */
export function sanitizeCreditError(errorMessage: string | null | undefined): string {
  if (!errorMessage) return 'Insufficient credits'

  const safeMessages = [
    'insufficient credits',
    'failed to deduct credits',
    'wallet balance too low',
  ]

  const lower = errorMessage.toLowerCase()
  for (const safe of safeMessages) {
    if (lower.includes(safe)) return 'Insufficient credits. Please add more credits to continue.'
  }

  return 'Insufficient credits'
}

/** The constant safe message, exported for direct use */
export const SAFE_ERROR_MESSAGE = SAFE_MESSAGE
