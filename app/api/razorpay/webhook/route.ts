import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-razorpay-signature')

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(body)
      .digest('hex')

    if (signature !== expectedSignature) {
      console.error('[Razorpay Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(body)
    console.log('[Razorpay Webhook] Event received:', event.event)

    // Handle subscription events
    switch (event.event) {
      case 'subscription.activated':
      case 'subscription.charged':
        await handleSubscriptionSuccess(event.payload.subscription.entity)
        break

      case 'subscription.cancelled':
      case 'subscription.expired':
        await handleSubscriptionEnd(event.payload.subscription.entity)
        break

      case 'payment.authorized':
      case 'payment.captured':
        await handlePaymentSuccess(event.payload.payment.entity)
        break

      default:
        console.log('[Razorpay Webhook] Unhandled event:', event.event)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Razorpay Webhook] Error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handleSubscriptionSuccess(subscription: any) {
  console.log('[Razorpay] Subscription activated:', subscription.id)

  const customerId = subscription.customer_id
  const planId = subscription.plan_id

  // Find user by Razorpay customer ID (need to store this during signup)
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('razorpay_customer_id', customerId)
    .single()

  if (error || !user) {
    console.error('[Razorpay] User not found for customer:', customerId)
    return
  }

  // Determine credits based on plan
  let creditsToAdd = 0
  if (planId === process.env.RAZORPAY_CREATOR_PLAN_ID) {
    creditsToAdd = 100 // Creator plan gives 100 credits
  }

  // Update user credits and subscription status
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({
      credits: user.credits + creditsToAdd,
      subscription_status: 'active',
      subscription_plan: planId,
      subscription_id: subscription.id,
      subscription_start: subscription.start_at,
      subscription_end: subscription.end_at,
      updated_at: new Date().toISOString()
    })
    .eq('clerk_user_id', user.clerk_user_id)

  if (updateError) {
    console.error('[Razorpay] Failed to update user:', updateError)
  } else {
    console.log('[Razorpay] Added', creditsToAdd, 'credits to user:', user.clerk_user_id)
  }
}

async function handleSubscriptionEnd(subscription: any) {
  console.log('[Razorpay] Subscription ended:', subscription.id)

  const { error } = await supabaseAdmin
    .from('users')
    .update({
      subscription_status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('subscription_id', subscription.id)

  if (error) {
    console.error('[Razorpay] Failed to update subscription status:', error)
  }
}

async function handlePaymentSuccess(payment: any) {
  console.log('[Razorpay] Payment captured:', payment.id)
  // Additional payment handling logic if needed
}
