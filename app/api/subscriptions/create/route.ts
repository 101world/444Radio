import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

// Plan configuration
const PLANS = {
  creator: {
    monthly: { planId: 'plan_S2DGVK6J270rtt', credits: 100, price: 450 },
    annual: { planId: 'plan_S2DJv0bFnWoNLS', credits: 1200, price: 4420 }
  },
  pro: {
    monthly: { planId: 'plan_S2DHUGo7n1m6iv', credits: 600, price: 1355 },
    annual: { planId: 'plan_S2DNEvy1YzYWNh', credits: 7200, price: 13090 }
  },
  studio: {
    monthly: { planId: 'plan_S2DIdCKNcV6TtA', credits: 1500, price: 3160 },
    annual: { planId: 'plan_S2DOABOeGedJHk', credits: 18000, price: 30330 }
  }
} as const

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      )
    }

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress

    if (!userEmail) {
      return corsResponse(
        NextResponse.json({ error: 'Email not found' }, { status: 400 })
      )
    }

    // Get plan and billing from request
    const body = await request.json()
    const planType = (body.plan || 'creator') as keyof typeof PLANS
    const billing = (body.billing || 'monthly') as 'monthly' | 'annual'
    
    const planConfig = PLANS[planType][billing]
    
    if (!planConfig) {
      return corsResponse(
        NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
      )
    }

    console.log(`[Subscription] Creating ${planType} ${billing} for:`, userId, userEmail)
    console.log('[Subscription] Plan:', planConfig)

    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    if (!keyId || !keySecret) {
      return corsResponse(
        NextResponse.json({ error: 'Configuration error' }, { status: 500 })
      )
    }

    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    const customerName = user.firstName && user.lastName 
      ? `${user.firstName} ${user.lastName}`.trim()
      : user.firstName || user.username || userEmail.split('@')[0]

    // Step 1: Create or get customer
    console.log('[Subscription] Step 1: Creating/getting customer...')
    const customerRes = await fetch('https://api.razorpay.com/v1/customers', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: customerName,
        email: userEmail,
        fail_existing: '0' // Return existing customer if found
      })
    })

    const customer = await customerRes.json()
    console.log('[Subscription] Customer:', customer.id)

    // Step 2: Update customer name
    console.log('[Subscription] Step 2: Updating customer name...')
    await fetch(`https://api.razorpay.com/v1/customers/${customer.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: customerName
      })
    })

    // Step 3: Create subscription
    console.log('[Subscription] Step 3: Creating subscription...')
    const subscriptionRes = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        plan_id: planConfig.planId,
        customer_id: customer.id,
        total_count: billing === 'annual' ? 1 : 12,
        quantity: 1,
        customer_notify: 1
      })
    })

    const subscription = await subscriptionRes.json()
    console.log('[Subscription] Subscription created:', subscription.id)

    // Step 4: Create payment link
    console.log('[Subscription] Step 4: Creating payment link...')
    const linkRes = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: planConfig.price * 100, // Convert to paise
        currency: 'INR',
        description: `${planType.toUpperCase()} ${billing === 'annual' ? 'Annual' : 'Monthly'} Plan - ${planConfig.credits} credits`,
        customer: {
          name: customerName,
          email: userEmail
        },
        notify: {
          sms: false,
          email: true
        },
        reminder_enable: true,
        notes: {
          clerk_user_id: userId,
          customer_id: customer.id,
          subscription_id: subscription.id,
          customer_name: customerName,
          plan_id: planConfig.planId,
          plan_type: planType,
          billing_cycle: billing,
          credits: planConfig.credits.toString()
        },
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://444radio.co.in'}/?payment=success`,
        callback_method: 'get'
      })
    })

    const link = await linkRes.json()
    
    if (!link.short_url) {
      console.error('[Subscription] No short_url in payment link:', link)
      return corsResponse(
        NextResponse.json({ 
          error: 'Payment link creation failed', 
          details: link 
        }, { status: 500 })
      )
    }

    console.log('[Subscription] ✅ Payment link created:', link.short_url)

    return corsResponse(
      NextResponse.json({
        success: true,
        short_url: link.short_url,
        subscription_id: subscription.id,
        customer_id: customer.id,
        plan: planType,
        billing,
        credits: planConfig.credits
      })
    )

  } catch (error: any) {
    console.error('[Subscription] Error:', error)
    return corsResponse(
      NextResponse.json({ 
        error: 'Subscription creation failed', 
        message: error.message 
      }, { status: 500 })
    )
  }
}
