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
 * POST /api/subscriptions/reactivate
 * Reactivate a cancelled Razorpay subscription (if cancelled with cancel_at_cycle_end)
 * Safe: Only works if subscription is still active but set to cancel at period end
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return corsResponse(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      )
    }

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
        NextResponse.json({ error: 'No subscription found' }, { status: 400 })
      )
    }

    console.log(`[Reactivate Subscription] User ${user.email} reactivating subscription ${user.subscription_id}`)

    // Call Razorpay API to cancel the cancellation (resume subscription)
    const razorpayAuth = Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
    ).toString('base64')

    // First, fetch current subscription status
    const fetchResponse = await fetch(
      `https://api.razorpay.com/v1/subscriptions/${user.subscription_id}`,
      {
        headers: {
          'Authorization': `Basic ${razorpayAuth}`
        }
      }
    )

    if (!fetchResponse.ok) {
      console.error('[Reactivate Subscription] Failed to fetch subscription')
      return corsResponse(
        NextResponse.json({ error: 'Failed to fetch subscription' }, { status: fetchResponse.status })
      )
    }

    const currentSub = await fetchResponse.json()

    // Check if subscription is set to cancel at cycle end
    if (!currentSub.cancel_at_cycle_end) {
      return corsResponse(
        NextResponse.json({ 
          error: 'Subscription is not scheduled for cancellation',
          message: 'Your subscription is already active and will auto-renew'
        }, { status: 400 })
      )
    }

    // Resume by canceling the cancellation - send PATCH with cancel_at_cycle_end: 0
    const resumeResponse = await fetch(
      `https://api.razorpay.com/v1/subscriptions/${user.subscription_id}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Basic ${razorpayAuth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cancel_at_cycle_end: 0 // Razorpay expects 0/1, not true/false
        })
      }
    )

    const razorpayData = await resumeResponse.json()

    if (!resumeResponse.ok) {
      console.error('[Reactivate Subscription] Razorpay error:', razorpayData)
      return corsResponse(
        NextResponse.json({
          error: 'Failed to reactivate subscription',
          details: razorpayData.error?.description || 'Unknown error'
        }, { status: resumeResponse.status })
      )
    }

    console.log('[Reactivate Subscription] Successfully reactivated subscription')

    // Update local database to ensure status is active
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        subscription_status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('clerk_user_id', userId)

    if (updateError) {
      console.error('[Reactivate Subscription] Failed to update database:', updateError)
    }

    return corsResponse(
      NextResponse.json({
        success: true,
        message: 'Subscription reactivated successfully',
        status: razorpayData.status,
        nextBillingDate: razorpayData.charge_at
      })
    )

  } catch (error: any) {
    console.error('[Reactivate Subscription] Error:', error)
    return corsResponse(
      NextResponse.json(
        { error: 'Failed to reactivate subscription', details: error.message },
        { status: 500 }
      )
    )
  }
}
