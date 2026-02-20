/**
 * Hybrid Auth Helper
 * 
 * Tries Clerk session auth first, falls back to plugin Bearer token auth.
 * Use this for API routes that need to work from both the website (Clerk)
 * and the plugin WebView (Bearer token).
 * 
 * Also supports Developer Mode for local testing via DEV_USER_ID env var.
 */

import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { authenticatePlugin } from './plugin-auth'

// Dev user ID for local development bypass
const DEV_USER_ID = process.env.DEV_USER_ID || 'dev-user-001'

export async function getAuthUserId(req: NextRequest): Promise<string | null> {
  // 0. Developer Mode bypass (only in development)
  if (process.env.NODE_ENV === 'development') {
    const devBypass = req.headers.get('x-dev-bypass') || req.nextUrl.searchParams.get('dev')
    if (devBypass === 'true' || devBypass === '1') {
      console.log('🔧 [DEV MODE] Using dev user bypass:', DEV_USER_ID)
      return DEV_USER_ID
    }
  }

  // 1. Try Clerk session auth
  try {
    const { userId } = await auth()
    if (userId) return userId
  } catch {
    // Clerk not available (e.g., plugin page with no ClerkProvider)
  }

  // 2. Try plugin Bearer token auth
  const bearerHeader = req.headers.get('authorization')
  if (bearerHeader?.startsWith('Bearer ')) {
    const result = await authenticatePlugin(req)
    if (result.valid) return result.userId
  }

  return null
}

/**
 * Check if we're in developer mode
 */
export function isDevMode(): boolean {
  return process.env.NODE_ENV === 'development'
}

/**
 * Get the dev user ID for local testing
 */
export function getDevUserId(): string {
  return DEV_USER_ID
}
