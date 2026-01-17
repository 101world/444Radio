import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

// Plan configuration (USD only for Razorpay Checkout with PayPal)
// NOTE: Razorpay may not support USD in test mode - check dashboard if orders fail
const USD_PLANS = {
  creator: {
    monthly: { credits: 100, price: 5 },
    annual: { credits: 1200, price: 50 }
  },
  pro: {
    monthly: { credits: 600, price: 16 },
    annual: { credits: 7200, price: 155 }
  },
  studio: {
    monthly: { credits: 1500, price: 37 },
    annual: { credits: 18000, price: 359 }
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

    const body = await request.json()
    const planType = (body.plan || 'creator') as keyof typeof USD_PLANS
    const billing = (body.billing || 'monthly') as 'monthly' | 'annual'
    
    const planConfig = USD_PLANS[planType][billing]
    
    if (!planConfig) {
      return corsResponse(
        NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
      )
    }

    console.log(`[Checkout] Creating USD checkout for ${planType} ${billing}:`, userId, userEmail)

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

    // Create short receipt (max 40 chars) - use last 8 chars of userId + timestamp
    const shortUserId = userId.slice(-8)
    const timestamp = Date.now().toString().slice(-8) // Last 8 digits
    const shortReceipt = `ord_${shortUserId}_${timestamp}` // ~25 chars

    // Create Razorpay Order for checkout
    const orderPayload = {
      amount: planConfig.price * 100, // Convert to cents
      currency: 'USD',
      receipt: shortReceipt,
      notes: {
        clerk_user_id: userId,
        customer_name: customerName,
        plan_type: planType,
        billing_cycle: billing,
        credits: planConfig.credits.toString()
      }
    }

    console.log('[Checkout] Creating order with payload:', orderPayload)

    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    })

    const order = await orderRes.json()
    
    console.log('[Checkout] Razorpay response status:', orderRes.status)
    console.log('[Checkout] Razorpay response:', order)

    if (!orderRes.ok || !order.id) {
      console.error('[Checkout] Order creation failed:', {
        status: orderRes.status,
        error: order.error || order,
        description: order.error?.description
      })
      return corsResponse(
        NextResponse.json({ 
          error: order.error?.description || 'Order creation failed',
          razorpay_error: order.error?.code || 'UNKNOWN',
          details: order 
        }, { status: 500 })
      )
    }

    console.log('[Checkout] ✅ Order created:', order.id)

    // Return order details for frontend Razorpay Checkout
    return corsResponse(
      NextResponse.json({
        success: true,
        orderId: order.id,
        amount: planConfig.price * 100,
        currency: 'USD',
        keyId: keyId,
        customerName: customerName,
        customerEmail: userEmail,
        plan: planType,
        billing,
        credits: planConfig.credits
      })
    )

  } catch (error: any) {
    console.error('[Checkout] Error:', error)
    return corsResponse(
      NextResponse.json({ 
        error: 'Checkout creation failed', 
        message: error.message 
      }, { status: 500 })
    )
  }
}
