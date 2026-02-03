import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'

/**
 * PayPal Subscription Success Handler
 * 
 * Called from client-side after user approves subscription
 * This stores the subscription ID temporarily - actual credits granted via webhook
 */

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { subscriptionId, planId } = body

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Missing subscriptionId' }, { status: 400 })
    }

    console.log('✅ PayPal subscription approved by user:', userId)
    console.log('📋 Subscription ID:', subscriptionId)
    console.log('📋 Plan ID:', planId)

    // Store subscription ID (credits will be added by webhook when PayPal confirms payment)
    const { error } = await supabase
      .from('users')
      .update({
        paypal_subscription_id: subscriptionId,
        subscription_status: 'pending', // Will be set to 'active' by webhook
        subscription_plan: 'creator',
        updated_at: new Date().toISOString()
      })
      .eq('clerk_user_id', userId)

    if (error) {
      console.error('❌ Failed to update user subscription:', error)
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Subscription approved! Credits will be added within 1-2 minutes.',
      subscriptionId 
    })

  } catch (error: any) {
    console.error('❌ PayPal success handler error:', error)
    return NextResponse.json({ 
      error: 'Failed to process subscription',
      details: error.message 
    }, { status: 500 })
  }
}
