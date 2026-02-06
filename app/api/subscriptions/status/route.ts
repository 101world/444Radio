import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/subscriptions/status
 * Fetch user's subscription details from database and Razorpay
 */
export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user data from Supabase
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('subscription_status, subscription_plan, subscription_id, razorpay_customer_id, subscription_start, subscription_end, email')
      .eq('clerk_user_id', userId)
      .single()

    if (userError || !user) {
      console.error('[Subscription Status] User not found:', userError)
      return NextResponse.json({ 
        success: true,
        hasSubscription: false 
      })
    }

    // If no active subscription, return basic info
    if (!user.subscription_status || user.subscription_status !== 'active') {
      return NextResponse.json({
        success: true,
        hasSubscription: false,
        status: user.subscription_status || 'none',
        plan: user.subscription_plan || null
      })
    }

    // If user has active subscription, fetch details from Razorpay
    let razorpayDetails = null
    
    if (user.subscription_id && user.subscription_id.startsWith('sub_')) {
      try {
        const razorpayAuth = Buffer.from(
          `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
        ).toString('base64')

        const response = await fetch(
          `https://api.razorpay.com/v1/subscriptions/${user.subscription_id}`,
          {
            headers: {
              'Authorization': `Basic ${razorpayAuth}`
            }
          }
        )

        if (response.ok) {
          razorpayDetails = await response.json()
        } else {
          console.error('[Subscription Status] Failed to fetch from Razorpay:', response.status)
        }
      } catch (fetchError) {
        console.error('[Subscription Status] Razorpay API error:', fetchError)
      }
    }

    // Map plan ID to friendly name
    const planName = getPlanName(user.subscription_plan)

    return NextResponse.json({
      success: true,
      hasSubscription: true,
      status: user.subscription_status,
      plan: planName,
      planId: user.subscription_plan,
      subscriptionId: user.subscription_id,
      startDate: user.subscription_start || razorpayDetails?.start_at,
      endDate: user.subscription_end || razorpayDetails?.end_at,
      currentPeriodEnd: razorpayDetails?.current_end || user.subscription_end,
      nextBillingDate: razorpayDetails?.charge_at,
      cancelAtPeriodEnd: razorpayDetails?.cancel_at_cycle_end || false,
      razorpayStatus: razorpayDetails?.status,
      totalCount: razorpayDetails?.total_count,
      paidCount: razorpayDetails?.paid_count
    })

  } catch (error: any) {
    console.error('[Subscription Status] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription status', details: error.message },
      { status: 500 }
    )
  }
}

function getPlanName(planId: string | null): string {
  if (!planId) return 'None'
  
  const planLower = planId.toLowerCase()
  
  if (planLower.includes('studio') || planLower.includes('s2di') || planLower.includes('s2do')) {
    return 'Studio'
  } else if (planLower.includes('pro') || planLower.includes('s2dh') || planLower.includes('s2dn')) {
    return 'Pro'
  } else if (planLower.includes('creator') || planLower.includes('s2dg') || planLower.includes('s2dj')) {
    return 'Creator'
  }
  
  return planId
}
