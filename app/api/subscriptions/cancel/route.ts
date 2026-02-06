import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { corsResponse, handleOptions } from '@/lib/cors'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function OPTIONS() {
  return handleOptions()
}

/**
 * POST /api/subscriptions/cancel
 * Cancel user's Razorpay subscription
 * Safe: Only cancels at period end, user keeps access until then
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return corsResponse(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      )
    }

    const body = await req.json()
    const { cancelAtCycleEnd = true } = body // Default: cancel at period end (safe)

    // Get user's subscription ID
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('subscription_id, subscription_status, email')
      .eq('clerk_user_id', userId)
      .single()

    if (userError || !user) {
      return corsResponse(
        NextResponse.json({ error: 'User not found' }, { status: 404 })
      )
    }

    if (!user.subscription_id || !user.subscription_id.startsWith('sub_')) {
      return corsResponse(
        NextResponse.json({ error: 'No active subscription found' }, { status: 400 })
      )
    }

    if (user.subscription_status !== 'active') {
      return corsResponse(
        NextResponse.json({ error: 'Subscription is not active' }, { status: 400 })
      )
    }

    console.log(`[Cancel Subscription] User ${user.email} canceling subscription ${user.subscription_id}`)

    // Call Razorpay API to cancel subscription
    const razorpayAuth = Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
    ).toString('base64')

    // Use PATCH method to update subscription with cancel_at_cycle_end
    // POST /cancel endpoint doesn't support cancel_at_cycle_end parameter
    const cancelPayload = {
      cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 // Razorpay expects 1/0, not true/false
    }

    const response = await fetch(
      `https://api.razorpay.com/v1/subscriptions/${user.subscription_id}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Basic ${razorpayAuth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cancelPayload)
      }
    )

    const razorpayData = await response.json()

    if (!response.ok) {
      console.error('[Cancel Subscription] Razorpay error:', razorpayData)
      return corsResponse(
        NextResponse.json({
          error: 'Failed to cancel subscription',
          details: razorpayData.error?.description || 'Unknown error'
        }, { status: response.status })
      )
    }

    console.log('[Cancel Subscription] Razorpay response:', razorpayData.status)

    // Update local database
    // If cancel_at_cycle_end is true, keep status as 'active' until webhook confirms cancellation
    // If immediate cancel, update to 'cancelled'
    const newStatus = cancelAtCycleEnd ? 'active' : 'cancelled'

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        subscription_status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('clerk_user_id', userId)

    if (updateError) {
      console.error('[Cancel Subscription] Failed to update database:', updateError)
    }

    return corsResponse(
      NextResponse.json({
        success: true,
        message: cancelAtCycleEnd 
          ? 'Subscription will be cancelled at the end of the billing period' 
          : 'Subscription cancelled immediately',
        status: razorpayData.status,
        endsAt: razorpayData.end_at,
        cancelAtCycleEnd: cancelAtCycleEnd
      })
    )

  } catch (error: any) {
    console.error('[Cancel Subscription] Error:', error)
    return corsResponse(
      NextResponse.json(
        { error: 'Failed to cancel subscription', details: error.message },
        { status: 500 }
      )
    )
  }
}
