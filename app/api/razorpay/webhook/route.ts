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

    // Razorpay webhook payload structure:
    // {
    //   event: "subscription.activated",
    //   payload: {
    //     subscription: { id, customer_id, plan_id, status, start_at, end_at, ... }
    //     payment: { id, amount, status, customer_id, ... }
    //   }
    // }
    // Note: Direct access - no .entity nested object
    
    // Handle subscription events
    switch (event.event) {
      case 'subscription.activated':
      case 'subscription.charged':
        await handleSubscriptionSuccess(event.payload.subscription)
        break

      case 'subscription.paused':
        await handleSubscriptionPaused(event.payload.subscription)
        break

      case 'subscription.resumed':
        await handleSubscriptionResumed(event.payload.subscription)
        break

      case 'subscription.cancelled':
      case 'subscription.expired':
        await handleSubscriptionEnd(event.payload.subscription)
        break

      case 'subscription.updated':
        await handleSubscriptionUpdated(event.payload.subscription)
        break

      case 'payment.authorized':
      case 'payment.captured':
        await handlePaymentSuccess(event.payload.payment)
        break

      case 'payment.failed':
        await handlePaymentFailed(event.payload.payment)
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

  // First try: Find user by Razorpay customer ID
  let { data: user, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('razorpay_customer_id', customerId)
    .single()

  // Second try: If not found by customer ID, fetch customer email from Razorpay and match
  if (error || !user) {
    console.log('[Razorpay] User not found by customer ID, fetching from Razorpay API')
    
    try {
      // Fetch customer details from Razorpay
      const razorpayAuth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')
      const customerResponse = await fetch(`https://api.razorpay.com/v1/customers/${customerId}`, {
        headers: {
          'Authorization': `Basic ${razorpayAuth}`
        }
      })

      if (customerResponse.ok) {
        const customer = await customerResponse.json()
        const email = customer.email

        console.log('[Razorpay] Customer email:', email)

        // Find user by email
        const { data: userByEmail, error: emailError } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('email', email)
          .single()

        if (!emailError && userByEmail) {
          user = userByEmail
          console.log('[Razorpay] Found user by email:', email)
          
          // Store the customer ID for future lookups
          await supabaseAdmin
            .from('users')
            .update({ razorpay_customer_id: customerId })
            .eq('clerk_user_id', user.clerk_user_id)
        }
      }
    } catch (fetchError) {
      console.error('[Razorpay] Failed to fetch customer from Razorpay:', fetchError)
    }
  }

  if (!user) {
    console.error('[Razorpay] User not found for customer:', customerId)
    return
  }

  // Determine credits based on plan (support both env var and hardcoded plan ID)
  let creditsToAdd = 0
  const creatorPlanId = process.env.RAZORPAY_CREATOR_PLAN_ID || 'plan_S2DGVK6J270rtt'
  if (planId === creatorPlanId) {
    creditsToAdd = 100 // Creator plan gives 100 credits
  }

  console.log('[Razorpay] Adding', creditsToAdd, 'credits to user:', user.clerk_user_id)

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
      razorpay_customer_id: customerId,
      updated_at: new Date().toISOString()
    })
    .eq('clerk_user_id', user.clerk_user_id)

  if (updateError) {
    console.error('[Razorpay] Failed to update user:', updateError)
  } else {
    console.log('[Razorpay] Successfully added', creditsToAdd, 'credits to user:', user.clerk_user_id)
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

async function handleSubscriptionPaused(subscription: any) {
  console.log('[Razorpay] Subscription paused:', subscription.id)

  const { error } = await supabaseAdmin
    .from('users')
    .update({
      subscription_status: 'paused',
      updated_at: new Date().toISOString()
    })
    .eq('subscription_id', subscription.id)

  if (error) {
    console.error('[Razorpay] Failed to update subscription status:', error)
  }
}

async function handleSubscriptionResumed(subscription: any) {
  console.log('[Razorpay] Subscription resumed:', subscription.id)

  const { error } = await supabaseAdmin
    .from('users')
    .update({
      subscription_status: 'active',
      updated_at: new Date().toISOString()
    })
    .eq('subscription_id', subscription.id)

  if (error) {
    console.error('[Razorpay] Failed to update subscription status:', error)
  }
}

async function handleSubscriptionUpdated(subscription: any) {
  console.log('[Razorpay] Subscription updated:', subscription.id)

  const { error } = await supabaseAdmin
    .from('users')
    .update({
      subscription_plan: subscription.plan_id,
      subscription_end: subscription.end_at,
      updated_at: new Date().toISOString()
    })
    .eq('subscription_id', subscription.id)

  if (error) {
    console.error('[Razorpay] Failed to update subscription:', error)
  }
}

async function handlePaymentSuccess(payment: any) {
  console.log('[Razorpay] Payment captured:', payment.id)
  // Additional payment handling logic if needed
}

async function handlePaymentFailed(payment: any) {
  console.log('[Razorpay] Payment failed:', payment.id)
  console.log('[Razorpay] Error:', payment.error_code, payment.error_description)
  // Optionally notify user about failed payment
}
