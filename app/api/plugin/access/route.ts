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

    // Get user subscription info
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('subscription_status, subscription_plan')
      .eq('clerk_user_id', userId)
      .single()

    // Check for one-time purchase
    const { data: purchase } = await supabaseAdmin
      .from('plugin_purchases')
      .select('id, created_at')
      .eq('clerk_user_id', userId)
      .eq('status', 'completed')
      .limit(1)
      .maybeSingle()

    const plan = (user?.subscription_plan || '').toLowerCase()
    const isActive = user?.subscription_status === 'active'

    let accessTier: string
    let hasAccess: boolean
    let rateLimit: number | null = null // null = unlimited
    let message: string

    // Studio active
    if (isActive && (plan.includes('studio') || ['plan_s2didckncv6tta', 'plan_s2doabogedjhk'].includes(plan))) {
      accessTier = 'studio'
      hasAccess = true
      rateLimit = null
      message = 'Unlimited plugin access (Studio plan)'
    }
    // Studio inactive
    else if (!isActive && (plan.includes('studio') || ['plan_s2didckncv6tta', 'plan_s2doabogedjhk'].includes(plan))) {
      accessTier = 'studio_inactive'
      hasAccess = false
      message = 'Studio subscription inactive. Resubscribe for plugin access.'
    }
    // Pro active
    else if (isActive && (plan.includes('pro') || ['plan_s2dhugo7n1m6iv', 'plan_s2dnevy1yzywnh'].includes(plan))) {
      accessTier = 'pro'
      hasAccess = true
      rateLimit = 200
      message = 'Plugin access included (200 requests/day)'
    }
    // Has one-time purchase
    else if (purchase) {
      accessTier = 'purchased'
      hasAccess = true
      rateLimit = null
      message = 'Unlimited plugin access (purchased)'
    }
    // No access
    else {
      accessTier = 'none'
      hasAccess = false
      message = 'Plugin requires a $25 one-time purchase or Pro/Studio subscription.'
    }

    return corsResponse(
      NextResponse.json({
        accessTier,
        hasAccess,
        rateLimit,
        message,
        hasPurchase: !!purchase,
        subscriptionPlan: user?.subscription_plan || null,
        subscriptionStatus: user?.subscription_status || 'none',
      })
    )
  } catch (error: any) {
    console.error('[Plugin Access] Error:', error)
    return corsResponse(
      NextResponse.json({ error: 'Failed to check access' }, { status: 500 })
    )
  }
}
