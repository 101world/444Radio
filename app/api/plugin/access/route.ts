/**
 * Plugin Access Status API
 * GET /api/plugin/access
 * Auth: Clerk session
 *
 * Returns the user's plugin access tier and status.
 * Used by pricing page and plugin UI to show correct state.
 */

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function OPTIONS() {
  return handleOptions()
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      )
    }

    // Get user wallet + credits info (wallet-based access model)
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('wallet_balance, credits')
      .eq('clerk_user_id', userId)
      .single()

    const walletBalance = parseFloat(user?.wallet_balance || '0')
    const hasWalletAccess = walletBalance >= 1.0 // $1 minimum for access

    let accessTier: string
    let hasAccess: boolean
    let rateLimit: number | null = null // null = unlimited
    let message: string

    // Has $1+ in wallet → full access (plugin is free)
    if (hasWalletAccess) {
      accessTier = 'wallet'
      hasAccess = true
      rateLimit = null
      message = 'Plugin access active ($1+ in wallet)'
    }
    // No access
    else {
      accessTier = 'none'
      hasAccess = false
      message = 'Deposit $1 minimum to your wallet for full access.'
    }

    return corsResponse(
      NextResponse.json({
        accessTier,
        hasAccess,
        rateLimit,
        message,
        walletBalance,
      })
    )
  } catch (error: unknown) {
    console.error('[Plugin Access] Error:', error)
    return corsResponse(
      NextResponse.json({ error: 'Failed to check access' }, { status: 500 })
    )
  }
}
