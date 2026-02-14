/**
 * Hybrid Auth Helper
 * 
 * Tries Clerk session auth first, falls back to plugin Bearer token auth.
 * Use this for API routes that need to work from both the website (Clerk)
 * and the plugin WebView (Bearer token).
 */

import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { authenticatePlugin } from './plugin-auth'

export async function getAuthUserId(req: NextRequest): Promise<string | null> {
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
