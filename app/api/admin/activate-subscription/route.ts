import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { ADMIN_CLERK_ID } from '@/lib/constants'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Admin-only guard
    if (clerkUserId !== ADMIN_CLERK_ID) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { razorpay_customer_id, credits_to_add = 100 } = await request.json()

    console.log('[Manual Subscription] Activating for customer:', razorpay_customer_id)

    // Find user by Clerk ID or Razorpay customer ID
    let query = supabaseAdmin.from('users').select('*')
    
    if (razorpay_customer_id) {
      query = query.eq('razorpay_customer_id', razorpay_customer_id)
    } else {
      query = query.eq('clerk_user_id', clerkUserId)
    }

    const { data: user, error: fetchError } = await query.single()

    if (fetchError || !user) {
      console.error('[Manual Subscription] User not found')
      return NextResponse.json({ 
        error: 'User not found',
        details: 'No user with this Razorpay customer ID or Clerk ID'
      }, { status: 404 })
    }

    console.log('[Manual Subscription] Found user:', user.clerk_user_id, 'Current credits:', user.credits)

    // Update user with subscription and add credits
    const { error: updateError, data: updated } = await supabaseAdmin
      .from('users')
      .update({
        credits: (user.credits || 0) + credits_to_add,
        razorpay_customer_id: razorpay_customer_id || user.razorpay_customer_id,
        subscription_status: 'active',
        subscription_plan: 'plan_S2DGVK6J270rtt',
        subscription_id: 'sub_S2ECfcFfPrjEm8',
        subscription_start: Math.floor(Date.now() / 1000),
        subscription_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
        updated_at: new Date().toISOString()
      })
      .eq('clerk_user_id', user.clerk_user_id)
      .select()

    if (updateError) {
      console.error('[Manual Subscription] Update failed:', updateError)
      return NextResponse.json({ 
        error: 'Failed to update subscription',
        details: updateError.message
      }, { status: 500 })
    }

    console.log('[Manual Subscription] Success! Added', credits_to_add, 'credits')

    return NextResponse.json({ 
      success: true,
      message: `Added ${credits_to_add} credits and activated Creator subscription`,
      user: updated[0],
      previous_credits: user.credits,
      new_credits: (user.credits || 0) + credits_to_add
    })
  } catch (error) {
    console.error('[Manual Subscription] Error:', error)
    return NextResponse.json({ 
      error: 'Failed to activate subscription',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
